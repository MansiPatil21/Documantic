import axios from "axios";
import { authHeader } from "./auth";

const EC2_BASE = process.env.REACT_APP_EC2_URL || "http://54.158.150.5:8000";
const API_GW_BASE =
  process.env.REACT_APP_API_GW_URL ||
  "https://8qaoyedz5m.execute-api.us-east-1.amazonaws.com";

const ec2 = axios.create({ baseURL: EC2_BASE });
const apigw = axios.create({ baseURL: API_GW_BASE });

export interface JobResponse {
  jobId: string;
  status: string;
}

export interface JobStatus {
  jobId: string;
  status: string;
  createdAt: number;
  outputFormat: string;
  progressStage?: string;
  languagesDetected?: string[];
  filesProcessed?: number;
  completedAt?: number;
  readmeContent?: string;
  apiDocsContent?: string;
  qualityContent?: string;
}

export interface DownloadResponse {
  jobId: string;
  downloadUrl: string;
}

export async function uploadZip(
  file: File,
  email?: string,
  outputFormat: string = "markdown"
): Promise<JobResponse> {
  const form = new FormData();
  form.append("file", file);
  if (email) form.append("email", email);
  form.append("output_format", outputFormat);
  const { data } = await ec2.post<JobResponse>("/upload", form, {
    headers: authHeader(),
  });
  return data;
}

export async function submitGithubUrl(
  url: string,
  email?: string,
  outputFormat: string = "markdown"
): Promise<JobResponse> {
  const form = new FormData();
  form.append("url", url);
  if (email) form.append("email", email);
  form.append("output_format", outputFormat);
  const { data } = await ec2.post<JobResponse>("/github", form, {
    headers: authHeader(),
  });
  return data;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const { data } = await apigw.get<JobStatus>(`/jobs/${jobId}`);
  return data;
}

export async function getDownloadUrl(jobId: string): Promise<DownloadResponse> {
  const { data } = await apigw.get<DownloadResponse>(
    `/jobs/${jobId}/download`
  );
  return data;
}

export interface CloudWatchMetrics {
  totalProcessed: number;
  successRate: number;
  avgDurationSeconds: number;
  error?: string;
}

export async function fetchCloudWatchMetrics(): Promise<CloudWatchMetrics> {
  try {
    const { data } = await ec2.get<CloudWatchMetrics>("/metrics");
    return data;
  } catch (err) {
    console.error("Failed to fetch CloudWatch metrics", err);
    return {
      totalProcessed: 0,
      successRate: 100,
      avgDurationSeconds: 0,
    };
  }
}
