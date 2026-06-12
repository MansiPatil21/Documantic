import axios from "axios";

const EC2_BASE = process.env.REACT_APP_EC2_URL || "http://54.158.150.5:8000";
const ec2 = axios.create({ baseURL: EC2_BASE });

export interface User {
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface DashboardJob {
  jobId: string;
  status: string;
  createdAt: number;
  languagesDetected: string[];
  filesProcessed: number;
}

export function getToken(): string | null {
  return localStorage.getItem("documantic_token");
}

export function getUser(): User | null {
  const raw = localStorage.getItem("documantic_user");
  return raw ? JSON.parse(raw) : null;
}

export function saveAuth(token: string, user: User) {
  localStorage.setItem("documantic_token", token);
  localStorage.setItem("documantic_user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("documantic_token");
  localStorage.removeItem("documantic_user");
}

export function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signup(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  const form = new FormData();
  form.append("email", email);
  form.append("password", password);
  form.append("name", name);
  const { data } = await ec2.post<AuthResponse>("/auth/signup", form);
  saveAuth(data.token, data.user);
  return data;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const form = new FormData();
  form.append("email", email);
  form.append("password", password);
  const { data } = await ec2.post<AuthResponse>("/auth/login", form);
  saveAuth(data.token, data.user);
  return data;
}

export async function fetchDashboardJobs(): Promise<DashboardJob[]> {
  const { data } = await ec2.get("/dashboard/jobs", {
    headers: authHeader(),
  });
  return data.jobs;
}
