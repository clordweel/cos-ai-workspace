import { useSearchParams } from 'react-router-dom';

/** 地址添加 ?mock=1 时使用前端本地 mock 演示数据（会话列表与消息），不请求后端会话接口 */
export function useMockMode(): boolean {
  const [searchParams] = useSearchParams();
  return searchParams.get('mock') === '1';
}
