// The pages shared by both adapters' fixtures reach the adapter through these names.
export const useRpc = () => useOrpc()
export const useRpcQueryClient = () => useOrpcQueryClient()
export const useManualRpc = () => useNuxtApp().$manualOrpc
export const usePostKey = (id: number) => useOrpc().blog.posts.get.queryKey({ input: { id } })
