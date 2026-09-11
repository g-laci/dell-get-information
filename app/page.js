"use client";

import Fuse from "fuse.js";
import {useEffect, useState} from "react";
import {TextArea, Button, Card, Spinner, Label, SearchField, Description} from "@heroui/react";
import {Image} from "@heroui/image";
import {FaCheck, FaCheckCircle, FaMemory} from "react-icons/fa";
import {FaMagnifyingGlass, FaTag, FaSquareCheck} from "react-icons/fa6";
import {BiCategory, BiRename, BiSolidRename} from "react-icons/bi";
import {BsAspectRatioFill, BsGpuCard} from "react-icons/bs";
import {IoMdResize} from "react-icons/io";
import {IoDocumentText} from "react-icons/io5";
import {LuCpu} from "react-icons/lu";
import {MdOutlineStorage} from "react-icons/md";

export default function Home() {
    const [tagsInput, setTagsInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

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

                            // Enrich each Dell result with Snipe-IT status
                            /*const snipe = await snipeITStatus(result.serviceTag);

                            const snipeStatus =
                                snipe?.assignedName != null
                                    ? `Assigned to ${snipe?.assignedName ?? "Not found"}${snipe?.assignedID ? ` (${snipe.assignedID})` : ""}`
                                    : (snipe?.statusName ?? "Not found");*/
                            if (res.ok) (
                                setResults((prev) => [
                                    ...prev,
                                    {
                                        ...result,
                                        //snipeStatus,
                                        //snipeRaw: snipe, // optional, useful for debugging
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

    /*
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
    };*/

    const fuse = results.length > 0
        ? new Fuse(results, {
            keys: ['assetName', 'serviceTag', 'category', 'cpu', 'memory', 'storage', 'gpu', 'size'],
            threshold: 0.3, // Controls fuzzy matching sensitivity (0 = exact, 1 = very fuzzy)
        })
        : null

    const filteredResults = searchTerm.trim() === ''
        ? results
        : fuse?.search(searchTerm).map(result => result.item) || [];

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

            <SearchField name="search" value={searchTerm} onChange={(value) => setSearchTerm(value)}>
                <Label>Search results</Label>
                <SearchField.Group>
                    <SearchField.SearchIcon/>
                    <SearchField.Input placeholder="Search something"/>
                    <SearchField.ClearButton/>
                </SearchField.Group>
                <Description>{filteredResults.length} of {results.length} results</Description>
            </SearchField>

            {filteredResults.map((r, i) => (
                <Card key={`${r.serviceTag}-${i}`}>
                    <Card.Content>
                        <table className="w-full text-sm ">
                            <tbody>
                            <tr>
                                <td className="flex flex-row gap-1 font-semibold pr-4 py-1 w-min whitespace-nowrap"><BiCategory size={18}/> Category</td>
                                <td className="w-full">{r.category}</td>
                            </tr>
                            <tr>
                                <td className="flex flex-row gap-1 font-semibold pr-4 py-1 w-min whitespace-nowrap"><FaTag size={18}/>Service Tag</td>
                                <td className="w-full">{r.serviceTag}</td>
                            </tr>
                            <tr>
                                <td className="flex flex-row gap-1 font-semibold pr-4 py-1 w-min whitespace-nowrap"><BiSolidRename size={18}/>Name</td>
                                <td className="w-full">{r.assetName}</td>
                            </tr>
                            {/* Only show these fields if it's a notebook */}
                            {r.category === "Notebook" && (
                                <>
                                    <tr>
                                        <td className="flex flex-row gap-1 font-semibold pr-4 py-1"><LuCpu size={18}/>CPU</td>
                                        <td>{r.cpu}</td>
                                    </tr>
                                    <tr>
                                        <td className="flex flex-row gap-1 font-semibold pr-4 py-1"><FaMemory size={18}/>Memory</td>
                                        <td>{r.memory}</td>
                                    </tr>
                                    <tr>
                                        <td className="flex flex-row gap-1 font-semibold pr-4 py-1"><MdOutlineStorage size={18}/>Storage</td>
                                        <td>{r.storage}</td>
                                    </tr>
                                    <tr>
                                        <td className="flex flex-row gap-1 font-semibold pr-4 py-1"><BsGpuCard size={18}/>GPU</td>
                                        <td>{r.gpu}</td>
                                    </tr>
                                </>
                            )}
                            {(r.category === "Notebook" || r.category === "Display") && (
                                <>
                                    <tr>
                                        <td className="flex flex-row gap-1 font-semibold pr-4 py-1"><BsAspectRatioFill size={18}/>Aspect Ratio</td>
                                        <td>{r.aspectRatio}</td>
                                    </tr>
                                    <tr>
                                        <td className="flex flex-row gap-1 font-semibold pr-4 py-1"><IoMdResize size={18}/>Size</td>
                                        <td>{r.size}</td>
                                    </tr>
                                </>
                            )}
                            <tr>
                                <td className="flex flex-row gap-1 font-semibold pr-4 py-1 w-min whitespace-nowrap"><IoDocumentText size={18}/>Warranty Start</td>
                                <td className="w-full">{r.warrantyStart}</td>
                            </tr>
                            </tbody>
                        </table>
                    </Card.Content>
                </Card>
            ))}
        </div>
    );
}
//asd