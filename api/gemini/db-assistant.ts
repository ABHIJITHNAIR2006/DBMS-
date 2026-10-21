import { dbAssistant } from '../../lib/geminiHandlers';
import { postHandler } from '../../lib/vercelWrap';

export default postHandler(dbAssistant);
