import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

/**
 * useToastMutation — standard mutation wrapper for entity CRUD.
 *
 * Gives every mutation:
 *   • Toast notifications  — success + error
 *   • Optimistic updates    — via `optimisticUpdater`, with automatic rollback on failure
 *   • Cache invalidation    — `queryKeys` are invalidated after success
 *
 * @param {Function} mutationFn            - the async mutation function
 * @param {Array}    queryKeys             - react-query keys to invalidate on success
 * @param {string}   successMessage        - toast title shown on success
 * @param {string}   errorMessage          - toast title shown on error
 * @param {Function} optimisticUpdater     - (queryClient, vars) => rollback function
 * @param {Function} onSuccess             - extra callback after the success toast
 * @param {Function} onError               - extra callback after the error toast
 */
export function useToastMutation({
  mutationFn,
  queryKeys = [],
  successMessage,
  errorMessage,
  optimisticUpdater,
  onSuccess,
  onError,
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      if (!optimisticUpdater) return undefined;
      const rollback = await optimisticUpdater(queryClient, vars);
      return { rollback };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.rollback) ctx.rollback();
      toast({
        title: errorMessage || 'Something went wrong',
        description: err?.message,
        variant: 'destructive',
      });
      onError?.(err, vars);
    },
    onSuccess: (data, vars) => {
      toast({ title: successMessage || 'Saved successfully' });
      queryKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
      onSuccess?.(data, vars);
    },
  });
}