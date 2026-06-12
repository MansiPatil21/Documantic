# ── SES email identity ─────────────────────────────────────────────────────────
# NOTE: After terraform apply, AWS will send a verification email to sender_email.
# You must click the link in that email before SES can send from this address.

resource "aws_ses_email_identity" "sender" {
  email = var.sender_email
}
