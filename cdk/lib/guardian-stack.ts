import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";
import { Construct } from "constructs";

export class GuardianStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── S3 Bucket for CSV uploads & analysis output ──
    const dataBucket = new s3.Bucket(this, "GuardianDataBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    // ── DynamoDB single-table ──
    const auditTable = new dynamodb.Table(this, "GuardianAuditTable", {
      tableName: "GuardianAuditLogs",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Shared Lambda layer ──
    const lambdasRoot = path.join(__dirname, "..", "..", "lambdas");

    const sharedLayer = new lambda.LayerVersion(this, "SharedLayer", {
      code: lambda.Code.fromAsset(path.join(lambdasRoot, "shared")),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: "Guardian shared models and DynamoDB helpers",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const commonEnv: Record<string, string> = {
      AUDIT_TABLE_NAME: auditTable.tableName,
      DATA_BUCKET_NAME: dataBucket.bucketName,
    };

    // ── Ingest Lambda ──
    const ingestLogGroup = new logs.LogGroup(this, "IngestLogGroup", {
      logGroupName: "/aws/lambda/GuardianIngestLambda",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const ingestFn = new lambda.Function(this, "IngestLambda", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.lambda_handler",
      code: lambda.Code.fromAsset(path.join(lambdasRoot, "ingest")),
      layers: [sharedLayer],
      environment: commonEnv,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      logGroup: ingestLogGroup,
    });

    dataBucket.grantReadWrite(ingestFn);
    auditTable.grantReadWriteData(ingestFn);
    // ── Logic Gate Lambda ──
    const logicGateLogGroup = new logs.LogGroup(this, "LogicGateLogGroup", {
      logGroupName: "/aws/lambda/GuardianLogicGateLambda",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const logicGateFn = new lambda.Function(this, "LogicGateLambda", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.lambda_handler",
      code: lambda.Code.fromAsset(path.join(lambdasRoot, "logic_gate")),
      layers: [sharedLayer],
      environment: commonEnv,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      logGroup: logicGateLogGroup,
    });

    dataBucket.grantRead(logicGateFn);
    auditTable.grantReadWriteData(logicGateFn);

    // Trigger Logic Gate when in-Lambda analysis writes output to S3
    dataBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(logicGateFn),
      { prefix: "output/", suffix: "analysis.json" }
    );

    // ── Socratic Chat Lambda ──
    const modelId = "global.anthropic.claude-sonnet-4-6";
    const modelArn = `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${modelId}`;

    const socraticChatLogGroup = new logs.LogGroup(this, "SocraticChatLogGroup", {
      logGroupName: "/aws/lambda/GuardianSocraticChatLambda",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const socraticChatFn = new lambda.Function(this, "SocraticChatLambda", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.lambda_handler",
      code: lambda.Code.fromAsset(path.join(lambdasRoot, "socratic_chat")),
      layers: [sharedLayer],
      environment: {
        ...commonEnv,
        MODEL_ARN: modelArn,
      },
      timeout: cdk.Duration.seconds(120),
      memorySize: 256,
      logGroup: socraticChatLogGroup,
    });

    auditTable.grantReadWriteData(socraticChatFn);
    socraticChatFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:Converse",
          "bedrock:GetInferenceProfile",
        ],
        resources: [
          modelArn,
          `arn:aws:bedrock:::foundation-model/anthropic.claude-sonnet-4-6`,
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-sonnet-*`,
          "*",
        ],
      })
    );

    // ── API Gateway ──
    const api = new apigateway.RestApi(this, "GuardianApi", {
      restApiName: "Guardian Bias Audit API",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
        ],
      },
    });

    // POST /audit
    const auditResource = api.root.addResource("audit");
    auditResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(ingestFn)
    );

    // GET /audits
    const auditsResource = api.root.addResource("audits");
    auditsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(logicGateFn)
    );

    // GET /audit/{auditId}
    const singleAudit = auditResource.addResource("{auditId}");
    singleAudit.addMethod(
      "GET",
      new apigateway.LambdaIntegration(logicGateFn)
    );

    // POST /chat
    const chatResource = api.root.addResource("chat");
    chatResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(socraticChatFn)
    );

    // ── Outputs ──
    new cdk.CfnOutput(this, "ApiUrl", { value: api.url });
    new cdk.CfnOutput(this, "DataBucketName", { value: dataBucket.bucketName });
    new cdk.CfnOutput(this, "AuditTableName", { value: auditTable.tableName });
  }
}
