import { useTranslation } from 'react-i18next';
export default function Notifications(){
  const { t } = useTranslation();
  return <h1>{t('nav.notifications')}</h1>;
}
