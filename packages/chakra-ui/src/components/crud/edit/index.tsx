import React from "react";

import {
    useMutationMode,
    useNavigation,
    useTranslate,
    userFriendlyResourceName,
    useRefineContext,
    useRouterType,
    useBack,
    useResource,
    useGo,
    useToPath,
} from "@refinedev/core";

import { Box, Heading, HStack, IconButton, Spinner } from "@chakra-ui/react";

// We use @tabler/icons for icons but you can use any icon library you want.
import { IconArrowLeft } from "@tabler/icons";

import {
    DeleteButton,
    ListButton,
    RefreshButton,
    SaveButton,
    Breadcrumb,
} from "@components";
import { EditProps } from "../types";

export const Edit: React.FC<EditProps> = (props) => {
    const {
        children,
        resource: resourceFromProps,
        recordItemId,
        deleteButtonProps,
        mutationMode: mutationModeFromProps,
        saveButtonProps,
        canDelete,
        dataProviderName,
        isLoading,
        footerButtons: footerButtonsFromProps,
        footerButtonProps,
        headerButtons: headerButtonsFromProps,
        headerButtonProps,
        wrapperProps,
        contentProps,
        headerProps,
        goBack: goBackFromProps,
        breadcrumb: breadcrumbFromProps,
        title,
    } = props;
    const translate = useTranslate();
    const { options: { breadcrumb: globalBreadcrumb } = {} } =
        useRefineContext();
    const { mutationMode: mutationModeContext } = useMutationMode();
    const mutationMode = mutationModeFromProps ?? mutationModeContext;

    const routerType = useRouterType();
    const back = useBack();
    const go = useGo();
    const { goBack, list: legacyGoList } = useNavigation();

    const {
        resource,
        action,
        id: idFromParams,
    } = useResource(resourceFromProps);

    const goListPath = useToPath({
        resource,
        action: "list",
    });

    const id = recordItemId ?? idFromParams;

    const breadcrumb =
        typeof breadcrumbFromProps === "undefined"
            ? globalBreadcrumb
            : breadcrumbFromProps;

    const isDeleteButtonVisible =
        canDelete ??
        ((resource?.meta?.canDelete ?? resource?.canDelete) ||
            deleteButtonProps);

    const defaultHeaderButtons = (
        <>
            {!recordItemId && (
                <ListButton
                    {...(isLoading ? { disabled: true } : {})}
                    resource={
                        routerType === "legacy"
                            ? resource?.route
                            : resource?.identifier ?? resource?.name
                    }
                />
            )}
            <RefreshButton
                {...(isLoading ? { disabled: true } : {})}
                resource={
                    routerType === "legacy"
                        ? resource?.route
                        : resource?.identifier ?? resource?.name
                }
                recordItemId={id}
                dataProviderName={dataProviderName}
            />
        </>
    );

    const defaultFooterButtons = (
        <>
            {isDeleteButtonVisible && (
                <DeleteButton
                    {...(isLoading ? { disabled: true } : {})}
                    resource={
                        routerType === "legacy"
                            ? resource?.route
                            : resource?.identifier ?? resource?.name
                    }
                    mutationMode={mutationMode}
                    onSuccess={() => {
                        if (routerType === "legacy") {
                            legacyGoList(
                                resource?.route ?? resource?.name ?? "",
                            );
                        } else {
                            go({ to: goListPath });
                        }
                    }}
                    recordItemId={id}
                    dataProviderName={dataProviderName}
                    {...deleteButtonProps}
                />
            )}
            <SaveButton
                {...(isLoading ? { disabled: true } : {})}
                {...saveButtonProps}
            />
        </>
    );

    const buttonBack =
        goBackFromProps === (false || null) ? null : (
            <IconButton
                aria-label="back"
                variant="ghost"
                size="sm"
                onClick={
                    action !== "list" && typeof action !== "undefined"
                        ? routerType === "legacy"
                            ? goBack
                            : back
                        : undefined
                }
            >
                {typeof goBackFromProps !== "undefined" ? (
                    goBackFromProps
                ) : (
                    <IconArrowLeft />
                )}
            </IconButton>
        );

    const headerButtons = headerButtonsFromProps
        ? typeof headerButtonsFromProps === "function"
            ? headerButtonsFromProps({
                  defaultButtons: defaultHeaderButtons,
              })
            : headerButtonsFromProps
        : defaultHeaderButtons;

    const footerButtons = footerButtonsFromProps
        ? typeof footerButtonsFromProps === "function"
            ? footerButtonsFromProps({ defaultButtons: defaultFooterButtons })
            : footerButtonsFromProps
        : defaultFooterButtons;

    const renderTitle = () => {
        if (title) {
            if (typeof title === "string" || typeof title === "number") {
                return (
                    <Heading as="h3" size="lg">
                        {title}
                    </Heading>
                );
            }

            return title;
        }

        return (
            <Heading as="h3" size="lg">
                {translate(
                    `${resource?.name}.titles.edit`,
                    `Edit ${userFriendlyResourceName(
                        resource?.meta?.label ??
                            resource?.options?.label ??
                            resource?.label ??
                            resource?.name,
                        "singular",
                    )}`,
                )}
            </Heading>
        );
    };

    return (
        <Box
            position="relative"
            bg="chakra-body-bg"
            borderRadius="md"
            px="4"
            py="3"
            {...wrapperProps}
        >
            {isLoading && (
                <Spinner
                    position="absolute"
                    top="50%"
                    left="50%"
                    transform="translate(-50%, -50%)"
                />
            )}
            <Box
                mb="3"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                flexWrap={{ base: "wrap", md: "nowrap" }}
                gap="3"
                {...headerProps}
            >
                <Box minW={200}>
                    {typeof breadcrumb !== "undefined" ? (
                        <>{breadcrumb}</> ?? undefined
                    ) : (
                        <Breadcrumb />
                    )}
                    <HStack spacing={2}>
                        {buttonBack}
                        {renderTitle()}
                    </HStack>
                </Box>
                <Box
                    display="flex"
                    flexWrap="wrap"
                    justifyContent={{ base: "flex-start", md: "flex-end" }}
                    gap="2"
                    {...headerButtonProps}
                >
                    {headerButtons}
                </Box>
            </Box>
            <Box opacity={isLoading ? 0.5 : undefined} {...contentProps}>
                {children}
            </Box>
            <Box
                display="flex"
                justifyContent="flex-end"
                gap="2"
                mt={8}
                {...footerButtonProps}
            >
                {footerButtons}
            </Box>
        </Box>
    );
};
