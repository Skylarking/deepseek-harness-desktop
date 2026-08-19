import { clientBundle } from '../../../packages/client/tsdown.client.ts'

// This support package intentionally replaces the profile-local resolution of
// the official layout package while a workspace plugin is enabled.
export default clientBundle('@deepseek-ai/dsh-client-ui-layout', ['lib/types/index.js', 'lib/types/invariant.js'])
