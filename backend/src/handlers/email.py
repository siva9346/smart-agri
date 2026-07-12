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
from email.utils import formataddr, formatdate, make_msgid

GMAIL_ADDRESS = os.environ['GMAIL_ADDRESS']
GMAIL_APP_PASSWORD = os.environ['GMAIL_APP_PASSWORD']
SENDER_NAME = 'Naveena Uzhavan'


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

    # A named From, plus Date/Message-ID/Reply-To, makes the message look like
    # normal person-to-person mail instead of an anonymous script send — this
    # is one of the biggest factors spam filters weigh for personal-Gmail SMTP.
    msg['Subject'] = subject
    msg['From'] = formataddr((SENDER_NAME, GMAIL_ADDRESS))
    msg['To'] = to_email
    msg['Reply-To'] = GMAIL_ADDRESS
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid(domain='gmail.com')

    with smtplib.SMTP('smtp.gmail.com', 587, timeout=8) as server:
        server.starttls()
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, [to_email], msg.as_string())

    return {'success': True}
