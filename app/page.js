"use client";

import {useEffect, useState} from "react";
import {TextArea, Button, Card, Spinner, Label} from "@heroui/react";
import {Image} from "@heroui/image";
import {FaCheck, FaCheckCircle} from "react-icons/fa";
import {FaMagnifyingGlass, FaSquareCheck} from "react-icons/fa6";

export default function Home() {
    const [tagsInput, setTagsInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);

    const handleLookup = async () => {
        setLoading(true);
        setResults([]); // Clear previous results

        const tags = tagsInput
            .split("\n")
            .map((t) => t.trim())
            .filter(Boolean);

        try {
            const res = await fetch("/api/asset-components", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({serviceTags: tags}),
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";



            while (true) {
                const {done, value} = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, {stream: true});
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const result = JSON.parse(line.slice(6));
                            console.log(result);

                            // Enrich each Dell result with Snipe-IT status
                            const snipe = await snipeITStatus(result.serviceTag);

                            const snipeStatus =
                                snipe?.assignedName != null
                                    ? `Assigned to ${snipe?.assignedName ?? "Not found"}${snipe?.assignedID ? ` (${snipe.assignedID})` : ""}`
                                    : (snipe?.statusName ?? "Not found");
                            if (res.ok) (
                                setResults((prev) => [
                                    ...prev,
                                    {
                                        ...result,
                                        snipeStatus,
                                        snipeRaw: snipe, // optional, useful for debugging
                                    },
                                ])
                            )
                        } catch (err) {
                            console.error("Error parsing result:", err);
                        }
                    }

                }
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const snipeITStatus = async (serviceTag) => {
        try {
            const res = await fetch("/api/snipe-it", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({serviceTag: serviceTag}),
            });
            return await res.json();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="mx-auto p-6 flex flex-col gap-6 w-4/5 md:w-1/2 ">
            <div className="flex flex-row items-center justify-center">
                <Image src="/dell.png" alt="dell" height={150}/>
                <Image src="/4ig.png" alt="4ig" height={150}/>
            </div>
            <div className="flex flex-col gap-2">
                <Label isRequired htmlFor="textarea-st">Service Tags</Label>
                <TextArea
                    id="textarea-st"
                    required={true}
                    placeholder="Enter one service tag per line"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    rows={15}
                    className="w-md"
                />
            </div>
            <div className="flex flex-row gap-4 items-center">
                <Button
                    color="primary"
                    onPress={handleLookup}
                    isPending={loading}
                    isDisabled={loading}
                >
                    {({isPending}) => (
                        <>
                            {isPending ? <Spinner color="current" size="sm"/> : <FaMagnifyingGlass/>}
                            Lookup Dell Assets
                        </>
                    )}
                </Button>
                <p>
                    {
                        tagsInput
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean).length
                    } asset recorded, {
                    results.length} assets found.

                </p>
                {tagsInput
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean).length === results.length && results.length > 0 && (
                    <FaCheck color="green" size={20} className="mb-1"/>
                )}
            </div>
            {results.map((r, i) => (
                <Card key={`${r.serviceTag}-${i}`}>
                    <Card.Content>
                        <table className="w-full text-sm ">
                            <tbody>
                            <tr>
                                <td className="font-semibold pr-4 py-1 w-min whitespace-nowrap">Category</td>
                                <td className="w-full">{r.category}</td>
                            </tr>
                            <tr>
                                <td className="font-semibold pr-4 py-1 w-min whitespace-nowrap">Service Tag</td>
                                <td className="w-full">{r.serviceTag}</td>
                            </tr>
                            <tr>
                                <td className="font-semibold pr-4 py-1 w-min whitespace-nowrap">Name</td>
                                <td className="w-full">{r.assetName}</td>
                            </tr>
                            {/* Only show these fields if it's a notebook */}
                            {r.category === "Notebook" && (
                                <>
                                    <tr>
                                        <td className="font-semibold pr-4 py-1">CPU</td>
                                        <td>{r.cpu}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold pr-4 py-1">Memory</td>
                                        <td>{r.memory}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold pr-4 py-1">Storage</td>
                                        <td>{r.storage}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold pr-4 py-1">GPU</td>
                                        <td>{r.gpu}</td>
                                    </tr>
                                </>
                            )}
                            {r.category === "Notebook" || r.category === "Display" && (
                                <tr>
                                    <td className="font-semibold pr-4 py-1">Size</td>
                                    <td>{r.size}</td>
                                </tr>
                            )}
                            <tr>
                                <td className="font-semibold pr-4 py-1 w-min whitespace-nowrap">Warranty Start</td>
                                <td className="w-full">{r.warrantyStart}</td>
                            </tr>
                            <tr>
                                <td className="font-semibold pr-4 py-1 w-min whitespace-nowrap">Snipe-IT Zrt Status</td>
                                <td className="w-full">{r.snipeStatus}</td>
                            </tr>
                            </tbody>
                        </table>
                    </Card.Content>
                </Card>
            ))}
        </div>
    );
}