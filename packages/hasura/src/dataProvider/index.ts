import { GraphQLClient } from "graphql-request";
import * as gql from "gql-query-builder";
import {
    CrudOperators,
    CrudFilters,
    CrudSorting,
    DataProvider,
    CrudFilter,
} from "@refinedev/core";
import setWith from "lodash/setWith";
import set from "lodash/set";

export type HasuraSortingType = Record<string, "asc" | "desc">;

export type GenerateSortingType = {
    (sorting?: CrudSorting): HasuraSortingType | undefined;
};

export const generateSorting: GenerateSortingType = (sorters?: CrudSorting) => {
    if (!sorters) {
        return undefined;
    }

    const sortingQueryResult: Record<
        string,
        "asc" | "desc" | HasuraSortingType
    > = {};

    sorters.forEach((sortItem) => {
        set(sortingQueryResult, sortItem.field, sortItem.order);
    });

    return sortingQueryResult as HasuraSortingType;
};

export type HasuraFilterCondition =
    | "_and"
    | "_not"
    | "_or"
    | "_eq"
    | "_gt"
    | "_gte"
    | "_lt"
    | "_lte"
    | "_neq"
    | "_in"
    | "_nin"
    | "_like"
    | "_nlike"
    | "_ilike"
    | "_nilike"
    | "_is_null"
    | "_similar"
    | "_nsimilar"
    | "_regex"
    | "_iregex";

const hasuraFilters: Record<CrudOperators, HasuraFilterCondition | undefined> =
    {
        eq: "_eq",
        ne: "_neq",
        lt: "_lt",
        gt: "_gt",
        lte: "_lte",
        gte: "_gte",
        in: "_in",
        nin: "_nin",
        contains: "_ilike",
        ncontains: "_nilike",
        containss: "_like",
        ncontainss: "_nlike",
        null: "_is_null",
        or: "_or",
        and: "_and",
        between: undefined,
        nbetween: undefined,
        nnull: "_is_null",
        startswith: "_iregex",
        nstartswith: "_iregex",
        endswith: "_iregex",
        nendswith: "_iregex",
        startswiths: "_similar",
        nstartswiths: "_nsimilar",
        endswiths: "_similar",
        nendswiths: "_nsimilar",
    };

export const handleFilterValue = (operator: CrudOperators, value: any) => {
    switch (operator) {
        case "startswiths":
        case "nstartswiths":
            return `${value}%`;
        case "endswiths":
        case "nendswiths":
            return `%${value}`;
        case "startswith":
            return `^${value}`;
        case "nstartswith":
            return `^(?!${value})`;
        case "endswith":
            return `${value}$`;
        case "nendswith":
            return `(?<!${value})$`;
        case "nnull":
            return false;
        case "contains":
        case "containss":
        case "ncontains":
        case "ncontainss":
            return `%${value}%`;
        default:
            return value;
    }
};

const generateNestedFilterQuery = (filter: CrudFilter): any => {
    const { operator } = filter;

    if (operator !== "or" && operator !== "and" && "field" in filter) {
        const { field, value } = filter;

        const hasuraOperator = hasuraFilters[filter.operator];
        if (!hasuraOperator) {
            throw new Error(`Operator ${operator} is not supported`);
        }

        const fieldsArray = field.split(".");
        const fieldsWithOperator = [...fieldsArray, hasuraOperator];
        const filteredValue = handleFilterValue(operator, value);

        return {
            ...setWith({}, fieldsWithOperator, filteredValue, Object),
        };
    }

    return {
        [`_${operator}`]: filter.value.map((f) => generateNestedFilterQuery(f)),
    };
};

export const generateFilters: any = (filters?: CrudFilters) => {
    if (!filters) {
        return undefined;
    }

    const nestedQuery = generateNestedFilterQuery({
        operator: "and",
        value: filters,
    });

    return nestedQuery;
};

export type HasuraDataProviderOptions = {
    idType?: "uuid" | "Int" | ((resource: string) => "uuid" | "Int");
};

const dataProvider = (
    client: GraphQLClient,
    options?: HasuraDataProviderOptions,
): Required<DataProvider> => {
    const { idType } = options ?? {};
    const getIdType = (resource: string) => {
        if (typeof idType === "function") {
            return idType(resource);
        }
        return idType ?? "uuid";
    };

    return {
        getOne: async ({ resource, id, meta }) => {
            const operation = `${meta?.operation ?? resource}_by_pk`;

            const { query, variables } = gql.query({
                operation,
                variables: {
                    id: {
                        value: id,
                        type: getIdType(resource),
                        required: true,
                    },
                    ...meta?.variables,
                },
                fields: meta?.fields,
            });

            const response = await client.request(query, variables);

            return {
                data: response[operation],
            };
        },

        getMany: async ({ resource, ids, meta }) => {
            const operation = meta?.operation ?? resource;

            const { query, variables } = gql.query({
                operation,
                fields: meta?.fields,
                variables: meta?.variables ?? {
                    where: {
                        type: `${operation}_bool_exp`,
                        value: {
                            id: {
                                _in: ids,
                            },
                        },
                    },
                },
            });

            const result = await client.request(query, variables);

            return {
                data: result[operation],
            };
        },

        getList: async ({ resource, sorters, filters, pagination, meta }) => {
            const {
                current = 1,
                pageSize: limit = 10,
                mode = "server",
            } = pagination ?? {};

            const hasuraSorting = generateSorting(sorters);
            const hasuraFilters = generateFilters(filters);

            const operation = meta?.operation ?? resource;

            const aggregateOperation = `${operation}_aggregate`;

            const hasuraSortingType = `[${operation}_order_by!]`;
            const hasuraFiltersType = `${operation}_bool_exp`;

            const { query, variables } = gql.query([
                {
                    operation,
                    fields: meta?.fields,
                    variables: {
                        ...(mode === "server"
                            ? {
                                  limit,
                                  offset: (current - 1) * limit,
                              }
                            : {}),
                        ...(hasuraSorting && {
                            order_by: {
                                value: hasuraSorting,
                                type: hasuraSortingType,
                            },
                        }),
                        ...(hasuraFilters && {
                            where: {
                                value: hasuraFilters,
                                type: hasuraFiltersType,
                            },
                        }),
                    },
                },
                {
                    operation: aggregateOperation,
                    fields: [{ aggregate: ["count"] }],
                    variables: {
                        where: {
                            value: hasuraFilters,
                            type: hasuraFiltersType,
                        },
                    },
                },
            ]);

            const result = await client.request(query, variables);

            return {
                data: result[operation],
                total: result[aggregateOperation].aggregate.count,
            };
        },

        create: async ({ resource, variables, meta }) => {
            const operation = meta?.operation ?? resource;

            const insertOperation = `insert_${operation}_one`;
            const insertType = `${operation}_insert_input`;

            const { query, variables: gqlVariables } = gql.mutation({
                operation: insertOperation,
                variables: {
                    object: {
                        type: insertType,
                        value: variables,
                        required: true,
                    },
                },
                fields: meta?.fields ?? ["id", ...Object.keys(variables || {})],
            });

            const response = await client.request(query, gqlVariables);

            return {
                data: response[insertOperation],
            };
        },

        createMany: async ({ resource, variables, meta }) => {
            const operation = meta?.operation ?? resource;

            const insertOperation = `insert_${operation}`;
            const insertType = `[${operation}_insert_input!]`;

            const { query, variables: gqlVariables } = gql.mutation({
                operation: insertOperation,
                variables: {
                    objects: {
                        type: insertType,
                        value: variables,
                        required: true,
                    },
                },
                fields: [
                    {
                        returning: meta?.fields ?? ["id"],
                    },
                ],
            });

            const response = await client.request(query, gqlVariables);

            return {
                data: response[insertOperation]["returning"],
            };
        },

        update: async ({ resource, id, variables, meta }) => {
            const operation = meta?.operation ?? resource;

            const updateOperation = `update_${operation}_by_pk`;

            const pkColumnsType = `${operation}_pk_columns_input`;
            const setInputType = `${operation}_set_input`;

            const { query, variables: gqlVariables } = gql.mutation({
                operation: updateOperation,
                variables: {
                    pk_columns: {
                        type: pkColumnsType,
                        value: {
                            id: id,
                        },
                        required: true,
                    },
                    _set: {
                        type: setInputType,
                        value: variables,
                        required: true,
                    },
                },
                fields: meta?.fields ?? ["id"],
            });

            const response = await client.request(query, gqlVariables);

            return {
                data: response[updateOperation],
            };
        },
        updateMany: async ({ resource, ids, variables, meta }) => {
            const operation = meta?.operation ?? resource;

            const updateOperation = `update_${operation}`;

            const whereType = `${operation}_bool_exp`;
            const setInputType = `${operation}_set_input`;

            const { query, variables: gqlVariables } = gql.mutation({
                operation: updateOperation,
                variables: {
                    where: {
                        type: whereType,
                        value: {
                            id: {
                                _in: ids,
                            },
                        },
                        required: true,
                    },
                    _set: {
                        type: setInputType,
                        value: variables,
                        required: true,
                    },
                },
                fields: [
                    {
                        returning: meta?.fields ?? ["id"],
                    },
                ],
            });

            const response = await client.request(query, gqlVariables);

            return {
                data: response[updateOperation]["returning"],
            };
        },

        deleteOne: async ({ resource, id, meta }) => {
            const operation = meta?.operation ?? resource;

            const deleteOperation = `delete_${operation}_by_pk`;

            const { query, variables } = gql.mutation({
                operation: deleteOperation,
                variables: {
                    id: {
                        value: id,
                        type: getIdType(resource),
                        required: true,
                    },
                    ...meta?.variables,
                },
                fields: meta?.fields ?? ["id"],
            });

            const response = await client.request(query, variables);

            return {
                data: response[deleteOperation],
            };
        },

        deleteMany: async ({ resource, ids, meta }) => {
            const operation = meta?.operation ?? resource;

            const deleteOperation = `delete_${operation}`;

            const whereType = `${operation}_bool_exp`;

            const { query, variables } = gql.mutation({
                operation: deleteOperation,
                fields: [
                    {
                        returning: meta?.fields ?? ["id"],
                    },
                ],
                variables: meta?.variables ?? {
                    where: {
                        type: whereType,
                        required: true,
                        value: {
                            id: {
                                _in: ids,
                            },
                        },
                    },
                },
            });

            const result = await client.request(query, variables);

            return {
                data: result[deleteOperation]["returning"],
            };
        },

        getApiUrl: () => {
            throw new Error(
                "getApiUrl method is not implemented on refine-hasura data provider.",
            );
        },

        custom: async ({ url, method, headers, meta }) => {
            let gqlClient = client;

            if (url) {
                gqlClient = new GraphQLClient(url, { headers });
            }

            if (meta) {
                if (meta.operation) {
                    if (method === "get") {
                        const { query, variables } = gql.query({
                            operation: meta.operation,
                            fields: meta.fields,
                            variables: meta.variables,
                        });

                        const response = await gqlClient.request(
                            query,
                            variables,
                        );

                        return {
                            data: response[meta.operation],
                        };
                    } else {
                        const { query, variables } = gql.mutation({
                            operation: meta.operation,
                            fields: meta.fields,
                            variables: meta.variables,
                        });

                        const response = await gqlClient.request(
                            query,
                            variables,
                        );

                        return {
                            data: response[meta.operation],
                        };
                    }
                } else {
                    throw Error("GraphQL operation name required.");
                }
            } else {
                throw Error(
                    "GraphQL need to operation, fields and variables values in meta object.",
                );
            }
        },
    };
};

export default dataProvider;
