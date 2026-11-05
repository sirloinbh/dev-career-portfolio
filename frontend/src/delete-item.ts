import { toast } from './components/ui/sonner';
import { RequestError } from './lib/api';
import { errorText } from './lib/use-notice';

// Deleting a row from an item list (#39 structure, shared from #41).

/** 을 after a final consonant (학력을), 를 after a vowel (프로젝트를). */
function objectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 !== 0 ? '을' : '를';
}

/**
 * Runs `remove` and reports the result in a toast. A row already gone (404) counts as deleted;
 * any other failure throws, so the open ConfirmDialog stays open. The dialog covers the page, so
 * the reason goes in a toast above it.
 */
export async function deleteItem({
  remove,
  noun,
  name,
}: {
  remove: () => Promise<unknown>;
  /** What the row is: '학력', '이력'. */
  noun: string;
  /** The row's own name, quoted in the success message. */
  name: string;
}) {
  const object = `${noun}${objectParticle(noun)}`;
  try {
    await remove();
  } catch (error) {
    if (!(error instanceof RequestError && error.status === 404)) {
      toast.error(`${object} 지우지 못했습니다. ${errorText(error)}`);
      throw error;
    }
  }
  toast.success(`'${name}' ${object} 지웠습니다`);
}
