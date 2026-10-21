import { itemAssistant } from '../../lib/geminiHandlers';
import { postHandler } from '../../lib/vercelWrap';

export default postHandler(itemAssistant);
