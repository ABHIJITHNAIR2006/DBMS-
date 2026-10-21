import { smartSearch } from '../../lib/geminiHandlers.js';
import { postHandler } from '../../lib/vercelWrap.js';

export default postHandler(smartSearch);
