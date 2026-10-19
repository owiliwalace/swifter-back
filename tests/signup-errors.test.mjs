import test from 'node:test';
import assert from 'node:assert/strict';
import {signupFailure} from '../services/signupErrors.js';
test('signup errors distinguish email limits, configuration and invalid input',()=>{
 assert.equal(signupFailure({code:'over_email_send_rate_limit'}).status,429);
 assert.equal(signupFailure({code:'weak_password'}).status,400);
 assert.equal(signupFailure({code:'signup_disabled'}).status,503);
 assert.match(signupFailure({code:'email_address_not_authorized'}).message,/SMTP settings/);
});
test('unknown provider errors do not expose raw account or database details',()=>{
 const failure=signupFailure({code:'unexpected_failure',message:'Private database details and email'});
 assert.equal(failure.code,'signup_failed');assert.equal(failure.status,503);
 assert.doesNotMatch(failure.message,/Private database/);
});
