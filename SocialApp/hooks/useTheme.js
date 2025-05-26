// hooks/useTheme.js
import { useColorScheme } from 'react-native';
import { light, dark }    from '../theme';

export default function useTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}