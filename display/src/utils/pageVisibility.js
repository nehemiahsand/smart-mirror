export function isPageWidgetVisible(settings, page, widgetId) {
    return settings?.pageVisibility?.[page]?.[widgetId] !== false;
}
