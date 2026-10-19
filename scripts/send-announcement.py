"""Send a standalone announcement with SMTP credentials supplied through the environment."""
import os, sys, ssl, smtplib
from pathlib import Path
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
sender=os.environ.get('SMTP_USER','')
password=os.environ.get('SMTP_PASS','')
if not sender or not password: raise SystemExit('SMTP_USER and SMTP_PASS are required.')
recipients=sys.argv[1:]
if not recipients or any('@' not in address or '\n' in address or '\r' in address for address in recipients): raise SystemExit('Supply valid recipient addresses.')
html=Path(__file__).resolve().parents[1].joinpath('announcement-email.html').read_text(encoding='utf-8')
text='The SwiftTrade website is now online!\n\nVisit https://www.swifttrade.co.ke to explore account and referral features and market analysis. Deposits, withdrawals and live trading remain subject to provider availability.\n\nThank you for your support.\nSwiftTrade'
try:
 with smtplib.SMTP_SSL(os.environ.get('SMTP_HOST','mail.swifttrade.co.ke'),int(os.environ.get('SMTP_PORT','465')),timeout=20,context=ssl.create_default_context()) as smtp:
  smtp.login(sender,password)
  for recipient in recipients:
   msg=EmailMessage();msg['From']='SwiftTrade <'+sender+'>';msg['To']=recipient;msg['Subject']='SwiftTrade Website Is Now Online';msg['Date']=formatdate(localtime=True);msg['Message-ID']=make_msgid(domain='swifttrade.co.ke');msg.set_content(text);msg.add_alternative(html,subtype='html')
   refused=smtp.send_message(msg)
   print(('Rejected: ' if refused else 'SMTP accepted: ')+recipient,flush=True)
except smtplib.SMTPAuthenticationError as error:
 print('SMTP authentication rejected (status '+str(error.smtp_code)+').',file=sys.stderr);sys.exit(1)
except Exception as error:
 print('SMTP delivery failed: '+type(error).__name__,file=sys.stderr);sys.exit(1)
