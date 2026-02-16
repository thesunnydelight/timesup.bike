// Type declarations for custom window properties

interface Window {
	__BUILD_TIME_DATA__?: any;
	__BUILD_TIME_TIMESTAMP__?: number;
	fetchAndRenderCharts?: (forceRefresh?: boolean) => Promise<void>;
}
