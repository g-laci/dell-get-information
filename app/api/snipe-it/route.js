import { NextResponse } from "next/server";
import axios from "axios";

const SNIPE_IT_BASE_URL = "https://4igit-itasset.4ig.hu/api/v1";
const SNIPE_IT_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiMmFhN2NkODkzNjg5NjMzODkxZjkyYTY2YWFjMjY5MDQxMTVkYjNlMzRiMWY5YTY1YjI3OGE4MzUxY2QxZTJiYjUyM2RlMzMwNzVmYzdiNjIiLCJpYXQiOjE3NzQ5NjE4ODcuMzExNiwibmJmIjoxNzc0OTYxODg3LjMxMTYwMiwiZXhwIjoyNDA2MTEzODg3LjI5MjQwNiwic3ViIjoiMzMyMSIsInNjb3BlcyI6W119.BrLLyRDQVKKjikmTSlYLX2CQT3LUvKMz1qxsGC2UntL3v8RYfiS4DgoY6XHs6_5wLSrRSeN_xxOckUT4jm4Ze1wa-Gkg7snvxHV2ldFnzOoGehTNXgds0bhDWZTuuwer3IEX3u5iuMwYIZS81KMwBs-Z9Lhq7YV0f-3ODXo7Gx1udlUG8-ExwEo5AUeOXEuN3w4P2JLP1OWhS9ljX4ry4H09SVUjQoaTH6uLB3TwekDdnOgysbge9kahEMpyZvDs1kCd4o-XqXW9xQpqQenGDDDdcW1ccy9ZDCGPlAgwsy3pDp1JHhcJwhYvzCtTaawxDiJPuO4yGL8oLy0CzK0WSl90Gh-nTIYNT_5_7KE1dux2gQwqIHwCXrwGnXAJpadxuDZ3u8dwF69FV3r8PZcYcGHdDepQ6N-T8Dnxi1w459iISeLDjdPXPzRYPM0oGzCXarKbW9yu1abB3hJr4fwerz4wDD2WKSjPGrfSfeIXv2MSBfDqYPInEHhHL7PGv8229Q7J3-nFw46iSCpm0-9wsftZVmMIOwFeRc2jH2Kws810mpICBOiM36hHo1bL8QyVFtef4O_Z9OPPhlxj8kyTUPkPAeZJDKl2JAmIL7iEsabE8jX6oUc4tQTwPyeaWO0Z16Pmv2mtUKn9mO78YMellgRujrfTqfyVMj9C6tNI1M4'


export async function POST(req) {
    try {
        const { serviceTag } = await req.json();

        if (!serviceTag || typeof serviceTag !== "string") {
            return NextResponse.json(
                { error: "Missing or invalid serviceTag" },
                { status: 400 }
            );
        }

        if (!SNIPE_IT_TOKEN) {
            return NextResponse.json(
                { error: "SNIPE_IT_TOKEN is not configured" },
                { status: 500 }
            );
        }

        const normalizedTag = serviceTag.trim();
        const url = `${SNIPE_IT_BASE_URL}/hardware/byserial/${encodeURIComponent(normalizedTag)}`;

        const snipeRes = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${SNIPE_IT_TOKEN}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            // Let us handle 404 as a normal "not found" response.
            validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
            timeout: 15000,
        });

        if (snipeRes.status === 404) {
            return NextResponse.json(
                { found: false, serviceTag: normalizedTag, asset: null },
                { status: 200 }
            );
        }

        const payload = snipeRes.data;
        const asset = payload?.rows?.[0] ?? null;

        return NextResponse.json({
            found: !!asset,
            serviceTag: normalizedTag,
            assetId: asset?.id ?? null,
            assetName: asset?.name ?? null,
            assetTag: asset?.asset_tag ?? null,
            statusId: asset?.status_label?.id ?? null,
            statusName: asset?.status_label?.name ?? null,
            assignedID: asset?.assigned_to?.username ?? null,
            assignedName: asset?.assigned_to?.name ?? null,
        });

    } catch (error) {
        if (axios.isAxiosError(error)) {
            const code = error.code || null;

            // Common TLS trust chain errors in internal/corporate PKI setups.
            if (
                code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
                code === "SELF_SIGNED_CERT_IN_CHAIN" ||
                code === "DEPTH_ZERO_SELF_SIGNED_CERT"
            ) {
                return NextResponse.json(
                    {
                        error: "TLS certificate validation failed",
                        code,
                        details:
                            "Node.js cannot validate the certificate chain. Use system CA or NODE_EXTRA_CA_CERTS with your internal root/intermediate CA.",
                    },
                    { status: 502 }
                );
            }

            return NextResponse.json(
                {
                    error: "Snipe-IT request failed",
                    code,
                    status: error.response?.status ?? null,
                    details: error.response?.data ?? error.message,
                },
                { status: error.response?.status ?? 502 }
            );
        }

        return NextResponse.json(
            { error: "Unexpected error", details: error?.message || String(error) },
            { status: 500 }
        );
    }
}
