import { useExperienceCopy } from '../hooks/useExperienceCopy';
import PresetIcon from './PresetIcon';

export default function AuthStory() {
  const e = useExperienceCopy();
  return (
    <aside className="auth-story" aria-label={e('A connected supply chain')}>
      <span className="experience-eyebrow">{e('INTELLI–FACTORY / CONNECTED WORK')}</span>
      <h2>
        {e('Different expertise.')} <br />
        <em>{e('Shared momentum.')}</em>
      </h2>
      <p>{e('A place for the people who source, make, and move things.')}</p>
      <div className="auth-network" aria-hidden>
        <div>
          <PresetIcon src="/presets/customer.svg" alt="" size={34} />
          <span>{e('Source')}</span>
        </div>
        <i />
        <div>
          <PresetIcon src="/presets/factory.svg" alt="" size={34} />
          <span>{e('Make')}</span>
        </div>
        <i />
        <div>
          <PresetIcon src="/presets/logist.svg" alt="" size={34} />
          <span>{e('Move')}</span>
        </div>
      </div>
      <div className="auth-story-foot">
        <span>{e('01 / A clear request')}</span>
        <span>{e('02 / The right partners')}</span>
        <span>{e('03 / A shared outcome')}</span>
      </div>
    </aside>
  );
}
