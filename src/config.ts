/**
 * Project-wide settings. This is the only file you need to edit to personalise
 * a deployment.
 */
export const config = {
  appName: 'Don’t Miss It',

  /**
   * Buy Me a Coffee page. Forks should change this to their own page.
   * Every donation link is hidden while this is an empty string.
   */
  donationUrl: 'https://buymeacoffee.com/eve703',

  /**
   * Public source repository. Forks should change this to their own repository.
   * Links to the source code are hidden while this is empty.
   */
  repositoryUrl: 'https://github.com/pangeve703/dont-miss-it',

  /**
   * Web app URL of the optional email reminder service (email-service/Code.gs,
   * deployed on Google Apps Script), ending in /exec.
   * The email reminder option is hidden while this is an empty string.
   */
  emailServiceUrl: '' as string,
} as const
