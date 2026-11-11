// 精简自 Movae/repository.ts：shopDesk 是纯浏览器环境，不存在原生桌面壳。
// exchangeRate.ts 仅在 isNative() 为 true 时走 nativeCall，
// 此处恒返回 false，使汇率始终走 frankfurter.dev 公共接口。
export const isNative = (): boolean => false;

export async function nativeCall(_method: string, _payload?: unknown): Promise<unknown> {
  throw new Error('shopDesk 浏览器环境不支持原生桥接调用');
}
