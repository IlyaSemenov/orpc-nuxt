// The pages shared by both adapters' fixtures reach the adapter through these names.
export const useRpc = () => useTrpc()
export const useRpcQueryClient = () => useTrpcQueryClient()
export const useManualRpc = () => useNuxtApp().$manualTrpc
export const usePostKey = (id: number) => useTrpc().blog.posts.get.queryKey({ id })
