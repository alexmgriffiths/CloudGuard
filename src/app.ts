import { EC2Client, DescribeSecurityGroupsCommand, DescribeSecurityGroupsCommandInput, RevokeSecurityGroupIngressCommand, RevokeSecurityGroupIngressCommandInput, AuthorizeSecurityGroupIngressCommand, AuthorizeSecurityGroupIngressCommandInput, SecurityGroup } from "@aws-sdk/client-ec2";
import axios from 'axios';

async function main() {
    try {
        const cloudflareIPs = await getCloudflareIPs();
        if (cloudflareIPs.success) {
            await updateSecurityGroupRules(cloudflareIPs.ipv4_cidrs);
            console.log('Security group rules updated successfully.');
        } else {
            console.error('Error connecting to Cloudflare:', JSON.stringify(cloudflareIPs.errors));
            process.exit(1);
        }
    } catch (error: any) {
        console.error('Failed to connect to Cloudflare:', error.message);
        process.exit(1);
    }
}

async function getCloudflareIPs() {
    const response = await axios.get('https://api.cloudflare.com/client/v4/ips');
    return response.data;
}

async function updateSecurityGroupRules(desiredAddresses: string[]) {
    const client = new EC2Client({
        region: process.env.AWS_REGION as string,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY as string,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
        }
    });

    const securityGroup = await describeSecurityGroup(client);

    if (!securityGroup) {
        console.log("No security group found");
        process.exit(1);
    }

    const existingAddresses = getExistingAddresses(securityGroup);
    await deleteUnusedIPs(client, securityGroup, existingAddresses, desiredAddresses);
    await addNewIPs(client, securityGroup, existingAddresses, desiredAddresses);
}

async function describeSecurityGroup(client: EC2Client) {
    const describeParams: DescribeSecurityGroupsCommandInput = {
        GroupIds: [process.env.AWS_SECURITY_GROUP_ID as string],
    };
    const describeCommand = new DescribeSecurityGroupsCommand(describeParams);
    const describeResult = await client.send(describeCommand);
    return describeResult.SecurityGroups && describeResult.SecurityGroups[0];
}

function getExistingAddresses(securityGroup: any) {
    const existingAddresses: string[] = [];
    if (securityGroup.IpPermissions) {
        securityGroup.IpPermissions.forEach((permission: any) => {
            permission.IpRanges.forEach((ipRange: any) => {
                existingAddresses.push(ipRange.CidrIp);
            });
        });
    }
    return existingAddresses;
}

async function deleteUnusedIPs(client: EC2Client, securityGroup: SecurityGroup, existingAddresses: string[], desiredAddresses: string[]) {
    const addressesToDelete = existingAddresses.filter((address) => !desiredAddresses.includes(address));

    for (const address of addressesToDelete) {
        const revokeParams: RevokeSecurityGroupIngressCommandInput = {
            GroupId: securityGroup.GroupId,
            IpPermissions: [
                {
                    FromPort: 80,
                    ToPort: 80,
                    IpProtocol: 'tcp',
                    IpRanges: [{ CidrIp: address }],
                },
                {
                    FromPort: 443,
                    ToPort: 443,
                    IpProtocol: 'tcp',
                    IpRanges: [{ CidrIp: address }],
                },
            ],
        };
        const revokeCommandInput = new RevokeSecurityGroupIngressCommand(revokeParams);
        await client.send(revokeCommandInput);
    }
}

async function addNewIPs(client: EC2Client, securityGroup: SecurityGroup, existingAddresses: string[], desiredAddresses: string[]) {
    const addressesToAdd = desiredAddresses.filter((address) => !existingAddresses.includes(address));

    const IpPermissions: any[] = addressesToAdd.flatMap((address) => ([
        {
            FromPort: 80,
            ToPort: 80,
            IpProtocol: 'tcp',
            IpRanges: [{ CidrIp: address }],
        },
        {
            FromPort: 443,
            ToPort: 443,
            IpProtocol: 'tcp',
            IpRanges: [{ CidrIp: address }],
        }
    ]));

    const params: AuthorizeSecurityGroupIngressCommandInput = {
        GroupId: securityGroup.GroupId,
        IpPermissions,
    };

    const authorizeCommand = new AuthorizeSecurityGroupIngressCommand(params);
    await client.send(authorizeCommand);
    console.log('New security group rules added.');
}

main();