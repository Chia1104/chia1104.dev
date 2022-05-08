import { FC } from "react";

export const SpinnerCollection: FC = () => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="flex flex-col">
                <div className="flex space-x-24">
                    <div className="container space-y-10 relative">
                        <h1 className="mb-8 text-xl font-semibold">
                            Regular Spinners
                        </h1>

                        <div className="flex flex-col">
                            <h4 className="mb-8">
                                Open Rings
                            </h4>

                            <div className="flex flex-row space-x-4">
                                <div className="w-12 h-12 rounded-full animate-spin
                    border border-solid border-yellow-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-2 border-solid border-blue-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-4 border-solid border-green-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-8 border-solid border-purple-500 border-t-transparent"></div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <h4 className="mb-8">
                                Closed Rings
                            </h4>

                            <div className="flex flex-row space-x-16">
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border border-solid border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border border-solid border-yellow-500 border-t-transparent"></div>
                                    </div>
                                </div>
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border-2 border-solid border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border-2 border-solid border-blue-500 border-t-transparent"></div>
                                    </div>
                                </div>
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border-4 border-solid border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border-4 border-solid border-green-500 border-t-transparent"></div>
                                    </div>
                                </div>
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border-8 border-solid border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border-8 border-solid border-purple-500 border-t-transparent"></div>
                                    </div>
                                </div>
                            </div>

                        </div>
                        <div className="flex flex-col">
                            <h4 className="my-8">
                                Edge X Rings
                            </h4>

                            <div className="flex flex-row space-x-4">
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x border-solid border-yellow-500 border-t-transparent"></div>

                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x-2 border-solid border-blue-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x-4 border-solid border-green-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x-8 border-solid border-purple-500 border-t-transparent"></div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <h4 className="mb-8">
                                Edge Y Rings
                            </h4>

                            <div className="flex flex-row space-x-4">
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y border-solid border-yellow-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y-2 border-solid border-blue-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y-4 border-solid border-green-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y-8 border-solid border-purple-500 border-t-transparent"></div>
                            </div>
                        </div>
                    </div>
                    <div className="container space-y-10 relative">
                        <h1 className="mb-8 text-xl font-semibold">
                            Dashed Spinners
                        </h1>
                        <div className="flex flex-col">
                            <h4 className="mb-8">
                                Open Rings
                            </h4>

                            <div className="flex flex-row space-x-4">
                                <div className="w-12 h-12 rounded-full animate-spin
                    border border-dashed border-yellow-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-2 border-dashed border-blue-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-4 border-dashed border-green-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-8 border-dashed border-purple-500 border-t-transparent"></div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <h4 className="mb-8">
                                Closed Rings
                            </h4>

                            <div className="flex flex-row space-x-16">
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border border-dashed border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border border-dashed border-yellow-500 border-t-transparent"></div>
                                    </div>
                                </div>
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border-2 border-dashed border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border-2 border-dashed border-blue-500 border-t-transparent"></div>
                                    </div>
                                </div>
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border-4 border-dashed border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border-4 border-dashed border-green-500 border-t-transparent"></div>
                                    </div>
                                </div>
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border-8 border-dashed border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border-8 border-dashed border-purple-500 border-t-transparent"></div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="flex flex-col">
                            <h4 className="my-8">
                                Edge X Rings
                            </h4>

                            <div className="flex flex-row space-x-4">
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x border-dashed border-yellow-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x-2 border-dashed border-blue-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x-4 border-dashed border-green-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x-8 border-dashed border-purple-500 border-t-transparent"></div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <h4 className="mb-8">
                                Edge Y Rings
                            </h4>

                            <div className="flex flex-row space-x-4">
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y border-dashed border-yellow-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y-2 border-dashed border-blue-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y-4 border-dashed border-green-500 border-t-transparent"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y-8 border-dashed border-purple-500 border-t-transparent"></div>
                            </div>
                        </div>
                    </div>
                    <div className="container space-y-10 relative">
                        <h1 className="mb-8 text-xl font-semibold">
                            Spinners With Shadow
                        </h1>
                        <div className="flex flex-col">
                            <h4 className="mb-8">
                                Open Rings
                            </h4>

                            <div className="flex flex-row space-x-4">
                                <div className="w-12 h-12 rounded-full animate-spin
                    border border-solid border-yellow-500 border-t-transparent shadow-md"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-2 border-solid border-blue-500 border-t-transparent shadow-md"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-4 border-solid border-green-500 border-t-transparent shadow-md"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-8 border-solid border-purple-500 border-t-transparent shadow-md"></div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <h4 className="mb-8">
                                Closed Rings
                            </h4>

                            <div className="flex flex-row space-x-16">
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border border-solid border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border border-solid border-yellow-500 border-t-transparent shadow-md"></div>
                                    </div>
                                </div>
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border-2 border-solid border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border-2 border-solid border-blue-500 border-t-transparent shadow-md"></div>
                                    </div>
                                </div>
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border-4 border-solid border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border-4 border-solid border-green-500 border-t-transparent shadow-md"></div>
                                    </div>
                                </div>
                                <div className="flex">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full absolute
                            border-8 border-solid border-gray-200"></div>
                                        <div className="w-12 h-12 rounded-full animate-spin absolute
                            border-8 border-solid border-purple-500 border-t-transparent shadow-md"></div>
                                    </div>
                                </div>
                            </div>

                        </div>
                        <div className="flex flex-col">
                            <h4 className="my-8">
                                Edge X Rings
                            </h4>

                            <div className="flex flex-row space-x-4">
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x border-solid border-yellow-500 border-t-transparent shadow-md"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x-2 border-solid border-blue-500 border-t-transparent shadow-md"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x-4 border-solid border-green-500 border-t-transparent shadow-md"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-x-8 border-solid border-purple-500 border-t-transparent shadow-md"></div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <h4 className="mb-8">
                                Edge Y Rings
                            </h4>

                            <div className="flex flex-row space-x-4">
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y border-solid border-yellow-500 border-t-transparent shadow-md"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y-2 border-solid border-blue-500 border-t-transparent shadow-md"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y-4 border-solid border-green-500 border-t-transparent shadow-md"></div>
                                <div className="w-12 h-12 rounded-full animate-spin
                    border-y-8 border-solid border-purple-500 border-t-transparent shadow-md"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
