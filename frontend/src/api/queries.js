import { QueryClient, useQuery } from '@tanstack/react-query';
import { catalogApi } from './index';

// Client errors (4xx) will not succeed on retry, so only retry network/server failures once.
const shouldRetry = (failureCount, error) =>
  failureCount < 1 && !(error?.status >= 400 && error?.status < 500);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
  },
});

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: catalogApi.getCategories,
    staleTime: 10 * 60 * 1000,
  });

export const useBrands = () =>
  useQuery({
    queryKey: ['brands'],
    queryFn: catalogApi.getBrands,
    staleTime: 10 * 60 * 1000,
  });

export const useProducts = (params, options = {}) =>
  useQuery({
    queryKey: ['products', params],
    queryFn: () => catalogApi.getProducts(params),
    ...options,
  });

export const useProduct = (idOrSlug) =>
  useQuery({
    queryKey: ['product', idOrSlug],
    queryFn: () => catalogApi.getProduct(idOrSlug),
    enabled: Boolean(idOrSlug),
  });

export const useProductReviews = (productId) =>
  useQuery({
    queryKey: ['product-reviews', productId],
    queryFn: () => catalogApi.getProductReviews(productId),
    enabled: Boolean(productId),
  });
