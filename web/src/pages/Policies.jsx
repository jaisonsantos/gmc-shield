import { useTranslation } from 'react-i18next';
import { Page, PageHeader, PageContent } from '../components/Page';
export default function Policies(){
  const { t } = useTranslation();
  return (
    <Page>
      <PageHeader>
        <h2 className="m-0 text-xl font-semibold">{t('policies.title') || 'Policies'}</h2>
      </PageHeader>
      <PageContent>
        <div className="text-gray-500">—</div>
      </PageContent>
    </Page>
  );
}
