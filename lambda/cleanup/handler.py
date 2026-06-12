"""
Cleanup Lambda — Triggered by EventBridge every 24 hours
Scans DynamoDB for expired jobs → deletes S3 objects → deletes DynamoDB items
"""
import os
import time
import json
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


def delete_s3_prefix(prefix):
    """Delete all objects under a given S3 prefix."""
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=STORAGE_BUCKET, Prefix=prefix):
        objects = page.get("Contents", [])
        if objects:
            s3.delete_objects(
                Bucket=STORAGE_BUCKET,
                Delete={"Objects": [{"Key": obj["Key"]} for obj in objects]},
            )
            logger.info("Deleted %d objects under %s", len(objects), prefix)


def lambda_handler(event, context):
    logger.info("Cleanup Lambda invoked")
    now = int(time.time())

    # Scan for expired jobs
    response = table.scan(
        FilterExpression="#e < :now",
        ExpressionAttributeNames={"#e": "expiry"},
        ExpressionAttributeValues={":now": now},
    )

    items = response.get("Items", [])
    logger.info("Found %d expired jobs", len(items))

    deleted = 0
    for item in items:
        job_id = item["jobId"]
        try:
            # Delete S3 files (uploads + outputs)
            delete_s3_prefix(f"uploads/{job_id}/")
            delete_s3_prefix(f"outputs/{job_id}/")

            # Delete DynamoDB record
            table.delete_item(Key={"jobId": job_id})
            deleted += 1
            logger.info("Cleaned up job %s", job_id)
        except Exception as e:
            logger.error("Failed to clean up job %s: %s", job_id, e)

    logger.info("Cleanup complete: %d/%d jobs removed", deleted, len(items))
    return {
        "statusCode": 200,
        "body": json.dumps({"expired": len(items), "deleted": deleted}),
    }
