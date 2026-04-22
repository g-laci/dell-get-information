import axios from "axios";

const CLIENT_ID = 'd00fcef4-c133-4968-bdc4-7500fe6a347a';
const CLIENT_SECRET = 'a44c9235fe1343dd8eb09d0de0709f48';
const TOKEN_URL = 'https://apigtwb2c.us.dell.com/auth/oauth/v2/token';

// 1️⃣ Get OAuth token (server-side only)
async function getAccessToken() {
    const response = await axios.post(
        TOKEN_URL,
        new URLSearchParams({
            grant_type: "client_credentials",
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        }),
        {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
    );
    return response.data.access_token;
}

// 2️⃣ Dell APIs
async function getWarrantyInfo(serviceTag, token) {
    const url = `https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/assets?servicetags=${serviceTag}`;
    const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    return res.data;
}

async function getAssetComponents(serviceTag, token) {
    const url = `https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/asset-components?servicetag=${serviceTag}`;
    const res = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "x-api-key": CLIENT_ID,
        },
    });
    return res.data;
}

// 3️⃣ Parse results
function parseDellAsset(warranty, asset) {
    const result = {
        category: null,
        assetName: warranty.productLineDescription || warranty.productLobDescription,
        serviceTag: warranty.serviceTag,
        warrantyStart: warranty.shipDate?.split("T")[0] || null,
        warrantyEnd: null,
        storage: null,
        memory: null,
        cpu: null,
        gpu: null,
        size: null,
    };

    const lob = warranty.productLobDescription?.toLowerCase() || "";
    if (lob.includes("laptop") || lob.includes("notebook") || lob.includes("latitude")) result.category = "Notebook";
    else if (lob.includes("display") || lob.includes("monitor")) result.category = "Display";
    else if (lob.includes("dock")) result.category = "Docking Station";
    else if (lob.includes("other")) result.category = "Docking Station (?)";
    else result.category = "Other Electronics";

    if (asset?.components?.length) {
        for (const comp of asset.components) {
            const desc = comp.itemDescription?.toLowerCase() || "";
            const itemNumber = comp.itemNumber || ""

            if (!result.size && /"/.test(desc)) {
                const match = desc.match(/(\d{2}\.?(\d)?\s*")/);
                if (match) result.size = match[1];
            }

            if (!result.cpu && itemNumber.includes("379") && /intel|amd/.test(desc)) result.cpu = comp.itemDescription;
            if (!result.memory && itemNumber.includes("370") && /gb/.test(desc)) result.memory = comp.itemDescription;
            if (!result.gpu && /graphics|gpu/.test(desc)) result.gpu = comp.itemDescription;
            if (!result.storage && itemNumber.includes("400") && /gb/.test(desc)) result.storage = comp.itemDescription;

            if (!result.storage && /ssd|hdd|pciessd|nvme/.test(desc)) {
                const match = desc.match(/(\d+\s?gb|\d+\s?tb)/i);
                if (match) result.storage = match[1];
            }
        }
    }

    return result;
}

// 4️⃣ API route - Stream results as they complete
export async function POST(req) {
    const { serviceTags } = await req.json();
    const token = await getAccessToken();

    const encoder = new TextEncoder();
    let stream = new ReadableStream({
        async start(controller) {
            try {
                for (const tag of serviceTags) {
                    try {
                        const warranty = await getWarrantyInfo(tag, token);
                        const asset = await getAssetComponents(tag, token);
                        if (asset?.invalid) {
                            console.error(`Invalid asset response for tag: ${tag}`);
                            continue;
                        }

                        if (warranty?.length) {
                            const result = parseDellAsset(warranty[0], asset);
                            const data = `data: ${JSON.stringify(result)}\n\n`;
                            controller.enqueue(encoder.encode(data));
                        }
                    } catch (err) {
                        console.error(`Error processing tag ${tag}:`, err);
                    }
                }
                controller.close();
            } catch (err) {
                console.error(err);
                controller.error(err);
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
