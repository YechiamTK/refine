import {
    GoConfig,
    RouterBindings,
    ResourceContext,
    matchResourceFromRoute,
    ParseResponse,
} from "@refinedev/core";
import { useRouter } from "next/router";
import Link from "next/link";
import { parse, stringify } from "qs";
import React, { ComponentProps, useContext } from "react";
import { paramsFromCurrentPath } from "../common/params-from-current-path";
import { convertToNumberIfPossible } from "src/common/convert-to-number-if-possible";

export const stringifyConfig = {
    addQueryPrefix: true,
    skipNulls: true,
    arrayFormat: "indices" as const,
    encode: false,
    encodeValuesOnly: true,
};

export const routerBindings: RouterBindings = {
    go: () => {
        const { push, replace, asPath: pathname } = useRouter();

        const fn = React.useCallback(
            ({
                to,
                type,
                query,
                options: { keepQuery, keepHash } = {},
                hash,
            }: GoConfig) => {
                let urlHash = "";

                if (keepHash && typeof document !== "undefined") {
                    urlHash = document.location.hash;
                }

                if (hash) {
                    urlHash = `#${hash.replace(/^#/, "")}`;
                }

                const urlQuery = {
                    ...(keepQuery
                        ? parse(pathname.split("?")[1], {
                              ignoreQueryPrefix: true,
                          })
                        : {}),
                    ...query,
                };

                if (urlQuery.to) {
                    urlQuery.to = encodeURIComponent(`${urlQuery.to}`);
                }

                const cleanPathname = pathname.split("?")[0].split("#")[0];

                const urlTo = to || cleanPathname;

                const hasUrlHash = urlHash.length > 1;
                const hasUrlQuery = Object.keys(urlQuery).length > 0;

                const fullPath = `${urlTo}${
                    hasUrlQuery ? stringify(urlQuery, stringifyConfig) : ""
                }${hasUrlHash ? urlHash : ""}`;

                if (type === "path") {
                    return fullPath;
                }

                if (type === "replace") {
                    replace(fullPath, undefined, {
                        shallow: typeof to === "undefined",
                    });
                } else {
                    push(fullPath);
                }

                return undefined;
            },
            [pathname, push, replace],
        );

        return fn;
    },
    back: () => {
        const { back } = useRouter();

        return back;
    },
    parse: () => {
        const { query, asPath: pathname } = useRouter();
        const { resources } = useContext(ResourceContext);

        const cleanPathname = pathname.split("?")[0].split("#")[0];

        const { resource, action, matchedRoute } = React.useMemo(() => {
            return matchResourceFromRoute(cleanPathname, resources);
        }, [cleanPathname, resources]);

        const inferredParams =
            matchedRoute && cleanPathname
                ? paramsFromCurrentPath(cleanPathname, matchedRoute)
                : {};

        const inferredId = inferredParams.id;

        const parsedParams = React.useMemo(() => {
            const searchParams = pathname.split("?")[1];
            return parse(searchParams, { ignoreQueryPrefix: true });
        }, [pathname]);

        const fn = React.useCallback(() => {
            const combinedParams = {
                ...inferredParams,
                ...query,
                ...parsedParams,
            };

            const response: ParseResponse = {
                ...(resource && { resource }),
                ...(action && { action }),
                ...(inferredId && { id: decodeURIComponent(inferredId) }),
                ...(query?.id && { id: decodeURIComponent(`${query?.id}`) }),
                pathname: cleanPathname,
                params: {
                    ...combinedParams,
                    current: convertToNumberIfPossible(
                        combinedParams.current as string,
                    ) as number | undefined,
                    pageSize: convertToNumberIfPossible(
                        combinedParams.pageSize as string,
                    ) as number | undefined,
                    to: combinedParams.to
                        ? decodeURIComponent(combinedParams.to as string)
                        : undefined,
                },
            };

            return response;
        }, [
            pathname,
            query,
            resource,
            action,
            inferredParams,
            inferredId,
            parsedParams,
        ]);

        return fn;
    },
    Link: React.forwardRef<
        HTMLAnchorElement,
        ComponentProps<NonNullable<RouterBindings["Link"]>>
    >(function RefineLink({ to, ...props }, ref) {
        return <Link href={to} {...props} ref={ref} />;
    }),
};
