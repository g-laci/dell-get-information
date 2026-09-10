import { NextResponse } from "next/server";
import axios from "axios";

const SNIPE_IT_BASE_URL = '';
const SNIPE_IT_TOKEN = ''


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
