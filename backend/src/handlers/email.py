"""
Internal-only Lambda — not exposed via API Gateway. Invoked directly by other
Lambdas (boto3 lambda.invoke) to send transactional email via Gmail SMTP using
smtplib (Python standard library — no paid service, no SES sandbox/verification).

Invocation payload: {"to": "user@example.com", "subject": "...", "body": "...", "html": "..." (optional)}
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

GMAIL_ADDRESS = os.environ['GMAIL_ADDRESS']
GMAIL_APP_PASSWORD = os.environ['GMAIL_APP_PASSWORD']


def handler(event, _ctx):
    to_email = event['to']
    subject = event['subject']
    body = event['body']
    html = event.get('html')

    if html:
        msg = MIMEMultipart('alternative')
        msg.attach(MIMEText(body, 'plain'))
        msg.attach(MIMEText(html, 'html'))
    else:
        msg = MIMEText(body, 'plain')

    msg['Subject'] = subject
    msg['From'] = GMAIL_ADDRESS
    msg['To'] = to_email

    with smtplib.SMTP('smtp.gmail.com', 587, timeout=8) as server:
        server.starttls()
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, [to_email], msg.as_string())

    return {'success': True}
