export function signupFailure(error){
 const messages={
  user_already_exists:[400,'Unable to create this account. Try signing in or resetting your password.'],
  email_exists:[400,'Unable to create this account. Try signing in or resetting your password.'],
  weak_password:[400,'Choose a stronger password that meets the account password requirements.'],
  signup_disabled:[503,'New account registration is currently disabled.'],
  over_email_send_rate_limit:[429,'Too many confirmation emails have been requested. Check your inbox and wait before trying again.'],
  over_request_rate_limit:[429,'Too many account requests. Please wait before trying again.'],
  email_address_not_authorized:[503,'Confirmation email delivery is not configured for this address. The operator needs to check EmailJS settings.'],
  email_address_invalid:[400,'Enter a valid email address.']
 };
 const known=Object.hasOwn(messages,error?.code||'');
 const [status,message]=known?messages[error.code]:[503,'The account service could not complete signup. The operator needs to check Firebase Authentication configuration.'];
 return {status,message,code:known?error.code:'signup_failed'};
}
