variable "name_prefix" {
  type = string
}

variable "groq_api_key" {
  type      = string
  sensitive = true
}
