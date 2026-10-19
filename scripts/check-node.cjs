// Intentionally compatible with old Node versions so startup explains the remedy.
var parts = process.versions.node.split('.').map(Number);
var supported = (parts[0] === 22 && parts[1] >= 12) || parts[0] >= 24;
if (!supported) {
  console.error('SwiftTrade requires Node.js 22.12+ (22.x) or Node.js 24+. Current version: ' + process.versions.node + '. Select Node.js 24 in your hosting control panel, reinstall dependencies, then restart the application.');
  process.exit(1);
}
