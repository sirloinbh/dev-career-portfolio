import { Wrench } from 'lucide-react';

import { EmptyState } from './components/ui/empty-state';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { errorText } from './lib/use-notice';
import { cn } from './lib/utils';
import { PageHeader } from './page-header';
import {
  groupSkills,
  maxProficiency,
  proficiencyText,
  type Skill,
  skillApi,
  skillCategoryLabels,
} from './skill-data';
import { TextBlocks } from './text-blocks';
import { useLoad } from './use-load';

const loadSkills = () => skillApi.list();

/**
 * Five dots, the first `value` filled, then "4/5". The dots and the short text are hidden from
 * screen readers, which read the full sentence instead ("숙련도 5점 중 4점").
 */
function Proficiency({ value }: { value: number }) {
  return (
    <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
      <span aria-hidden className="flex gap-1">
        {Array.from({ length: maxProficiency }, (_, index) => (
          <span
            key={index}
            className={cn(
              // 60% keeps an empty dot's outline at 3:1 or more on the white card, not only the dark one.
              'size-2.5 rounded-full border border-foreground/60',
              index < value ? 'bg-foreground' : 'bg-transparent',
            )}
          />
        ))}
      </span>
      <span aria-hidden>
        {value}/{maxProficiency}
      </span>
      <span className="sr-only">{proficiencyText(value)}</span>
    </p>
  );
}

function SkillItem({ skill }: { skill: Skill }) {
  const titleId = `skill-${skill.id}`;
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {/* break-keep keeps Korean words whole; wrap-anywhere still breaks a long unspaced name at 390px. */}
        <h3 id={titleId} className="text-body font-semibold wrap-anywhere break-keep">
          {skill.name}
        </h3>
        <Proficiency value={skill.proficiency} />
      </div>
      <TextBlocks entries={[['메모', skill.memo]]} />
    </li>
  );
}

export function SkillList() {
  const loaded = useLoad('all', loadSkills);
  const skills = loaded.state === 'ok' ? loaded.data.skills : [];
  const loading = loaded.state === 'loading';
  return (
    <section aria-labelledby="page-title" aria-busy={loading} className="flex flex-col gap-6">
      <PageHeader title="스킬" description="다룰 수 있는 기술을 분류별로 봅니다.">
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {loading ? '스킬을 불러오는 중' : ''}
          {loaded.state === 'ok' ? `스킬 ${skills.length}건` : ''}
        </p>
      </PageHeader>
      {loading ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{ kind: 'error', text: `스킬을 불러오지 못했습니다. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {loaded.state === 'ok' && skills.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<Wrench />}
          title="아직 등록한 스킬이 없습니다"
          description="스킬을 등록하면 분류별로 숙련도 높은 순으로 여기에 보입니다."
        />
      ) : null}
      {groupSkills(skills).map((group) => {
        const label = skillCategoryLabels[group.category];
        return (
          // A plain group, not a landmark: six category regions would crowd the landmark list, and
          // the heading already lets a screen reader jump between categories.
          <div key={group.category} className="flex flex-col gap-3">
            <h2 className="flex items-baseline gap-2">
              {label}{' '}
              <span className="text-body-sm font-normal text-muted-foreground">
                {group.skills.length}건
              </span>
            </h2>
            {/* Unnamed: the heading just above names it, and the list itself says how many items. */}
            <ul className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm">
              {group.skills.map((skill) => (
                <SkillItem key={skill.id} skill={skill} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
