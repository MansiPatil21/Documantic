"""
API Lambda — handles job status and presigned download URL requests
Routes:
  GET /jobs/{jobId}          → return job status from DynamoDB
  GET /jobs/{jobId}/download → return presigned S3 URL for output zip
"""
import json
import os
import logging

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

STORAGE_BUCKET = os.environ["STORAGE_BUCKET"]
DYNAMODB_TABLE = os.environ["DYNAMODB_TABLE"]
REGION = os.environ.get("AWS_REGION_NAME", "us-east-1")

s3 = boto3.client("s3", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(DYNAMODB_TABLE)


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    logger.info("API Lambda invoked")
    logger.info(json.dumps(event))

    route = event.get("routeKey", "")
    path_params = event.get("pathParameters", {}) or {}
    job_id = path_params.get("jobId")

    if not job_id:
        return _response(400, {"error": "Missing jobId"})

    # Look up job in DynamoDB
    resp = table.get_item(Key={"jobId": job_id})
    item = resp.get("Item")

    if not item:
        return _response(404, {"error": "Job not found"})

    # GET /jobs/{jobId}/download
    if "download" in route:
        if item["status"] != "complete":
            return _response(400, {
                "error": f"Job not complete. Current status: {item['status']}",
                "status": item["status"],
            })

        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": STORAGE_BUCKET, "Key": item["outputKey"]},
            ExpiresIn=3600,
        )
        return _response(200, {
            "jobId": job_id,
            "downloadUrl": url,
        })

    # GET /jobs/{jobId}
    result = {
        "jobId": item["jobId"],
        "status": item["status"],
        "createdAt": int(item.get("createdAt", 0)),
        "outputFormat": item.get("outputFormat", "markdown"),
    }
    if item.get("progressStage"):
        result["progressStage"] = item["progressStage"]
    if item.get("languagesDetected"):
        result["languagesDetected"] = item["languagesDetected"]
    if item.get("filesProcessed"):
        result["filesProcessed"] = int(item["filesProcessed"])
    if item.get("completedAt"):
        result["completedAt"] = int(item["completedAt"])
    # Include doc previews when job is complete
    if item["status"] == "complete":
        if item.get("readmeContent"):
            result["readmeContent"] = item["readmeContent"]
        if item.get("apiDocsContent"):
            result["apiDocsContent"] = item["apiDocsContent"]
        if item.get("qualityContent"):
            result["qualityContent"] = item["qualityContent"]

    return _response(200, result)
