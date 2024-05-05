import { EC2Client, DescribeSecurityGroupsCommand, DescribeSecurityGroupsCommandInput, RevokeSecurityGroupIngressCommand, RevokeSecurityGroupIngressCommandInput, AuthorizeSecurityGroupIngressCommand, AuthorizeSecurityGroupIngressCommandInput, SecurityGroup } from "@aws-sdk/client-ec2";
import axios from 'axios';
import { config } from 'dotenv'
import net from 'net';
config()

async function main() {
    try {
        const cloudflareIPs = await getCloudflareIPs();
        if (cloudflareIPs.success) {
            await updateSecurityGroupRules(cloudflareIPs.result.ipv4_cidrs);
            await updateSecurityGroupRules(cloudflareIPs.result.ipv6_cidrs, true);
            console.log('Security group rules updated successfully.');
        } else {
            console.error('Error connecting to Cloudflare:', JSON.stringify(cloudflareIPs.errors));
            process.exit(1);
        }
    } catch (error: any) {
        console.error('Failed to complete:', error.message);
        process.exit(1);
    }
}

async function getCloudflareIPs() {
    const response = await axios.get('https://api.cloudflare.com/client/v4/ips');
    return response.data;
}

async function updateSecurityGroupRules(desiredAddresses: string[], ipv6: boolean = false) {
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
    await deleteUnusedIPs(client, securityGroup, existingAddresses, desiredAddresses, ipv6);
    await addNewIPs(client, securityGroup, existingAddresses, desiredAddresses, ipv6);
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
            console.log(permission)
            permission.IpRanges.forEach((ipRange: any) => {
                existingAddresses.push(ipRange.CidrIp);
            });
            permission.Ipv6Ranges.forEach((ipRange: any) => {
                existingAddresses.push(ipRange.CidrIpv6);
            });
        });
    }
    return existingAddresses;
}

async function deleteUnusedIPs(client: EC2Client, securityGroup: SecurityGroup, existingAddresses: string[], desiredAddresses: string[], ipv6: boolean = false) {
    console.log("Deleting new IPv6s: ", ipv6)
    const addressesToDelete = existingAddresses.filter((address) => !desiredAddresses.includes(address));
    for (const address of addressesToDelete) {

        if(ipv6 && !net.isIPv6(address)) continue;
        if(!ipv6 && !net.isIPv4(address)) continue;

        let revokeParams: RevokeSecurityGroupIngressCommandInput;
        if(!ipv6) {
            revokeParams = {
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
        } else {
            console.log("Deleteing unused IPv6")
            revokeParams = {
                GroupId: securityGroup.GroupId,
                IpPermissions: [
                    {
                        FromPort: 80,
                        ToPort: 80,
                        IpProtocol: 'tcp',
                        Ipv6Ranges: [{ CidrIpv6: address }],
                    },
                    {
                        FromPort: 443,
                        ToPort: 443,
                        IpProtocol: 'tcp',
                        Ipv6Ranges: [{ CidrIpv6: address }],
                    },
                ],
            };
        }
        const revokeCommandInput = new RevokeSecurityGroupIngressCommand(revokeParams);
        await client.send(revokeCommandInput);
    }
    console.log("Deleted unused IPs")
}

async function addNewIPs(client: EC2Client, securityGroup: SecurityGroup, existingAddresses: string[], desiredAddresses: string[], ipv6: boolean = false) {
    const addressesToAdd = desiredAddresses.filter((address) => !existingAddresses.includes(address));
    console.log("Adding IPv6?", ipv6)
    console.log(desiredAddresses)
    console.log("addresses to add", addressesToAdd)
    let IpPermissions: any[];
    if(!ipv6) {
        IpPermissions = addressesToAdd.flatMap((address) => ([
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
    } else {
        console.log("Adding IPv6s")
        IpPermissions = addressesToAdd.flatMap((address) => ([
            {
                FromPort: 80,
                ToPort: 80,
                IpProtocol: 'tcp',
                Ipv6Ranges: [{ CidrIpv6: address }],
            },
            {
                FromPort: 443,
                ToPort: 443,
                IpProtocol: 'tcp',
                Ipv6Ranges: [{ CidrIpv6: address }],
            }
        ]));
    }

    if(addressesToAdd.length > 0) {
        const params: AuthorizeSecurityGroupIngressCommandInput = {
            GroupId: securityGroup.GroupId,
            IpPermissions,
        };

        const authorizeCommand = new AuthorizeSecurityGroupIngressCommand(params);
        await client.send(authorizeCommand);
        console.log('New security group rules added.');
    } else {
        console.log("No new addresses to add")
    }
}

main();