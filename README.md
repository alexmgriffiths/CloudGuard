# CloudGuard Project

The CloudGuard Project is a tool designed to keep your AWS security group in sync with Cloudflare's IPv4 addresses. By ensuring that your security group only allows authorized connections, this project enhances the security of your AWS resources.

## How It Works

1. **Fetch Cloudflare IPv4s:** The project retrieves the latest list of Cloudflare's IPv4 addresses, ensuring your AWS environment remains up-to-date.

2. **Security Group Update:** It identifies your AWS security group using the provided security group ID and evaluates its current IP permissions.

3. **IP Management:** The CloudGuard Project intelligently manages IP addresses. It removes outdated IPs and ensures your security group is cleaned from obsolete entries.

4. **Rule Creation:** The tool adds new, relevant IPs to your security group, maintaining a secure connection with Cloudflare while blocking unauthorized access.

## Usage

1. Clone the repository and navigate to the project directory.

2. Create an empty security group in AWS

3. Set up your AWS credentials and environment variables in the `.env` file.
    ```
    AWS_REGION=us-east-1
    AWS_ACCESS_KEY=xxxx
    AWS_SECRET_ACCESS_KEY=xxxxx
    AWS_SECURITY_GROUP_ID=xxxx
    ````
4. Run the script using your preferred Node.js environment: `npm run start`.

## Requirements

- Node.js environment
- AWS IAM credentials

## Benefits

- **Automated Security:** Eliminate manual updates and ensure security group consistency.
- **Enhanced Protection:** Keep your AWS resources secure by allowing only authorized IPs.
- **Simplified Workflow:** Straightforward setup and execution process.
- **Current and Relevant:** Always stay up-to-date with the latest Cloudflare IPs.

## Todo

- **Convert Lambda function**

## Contribution

Contributions are welcome! Feel free to submit issues, pull requests, or suggestions to improve the project.

## License

This project is licensed under the [MIT License](LICENSE).
