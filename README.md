# Liquid Metal

一个全屏 WebGL2 片元着色器小作品：一块会流动的液态金属表面。

- 表面高度场：domain-warped fbm 噪声 + 点击产生的环形涟漪
- 光照：有限差分求法线，环境反射（柔光箱 / 地平线）、菲涅尔、跟随鼠标的点光源高光
- 材质：水银 / 珍珠（虹彩薄膜）/ 黄金 / 黑曜石，切换时参数平滑过渡
- 交互：移动鼠标打光，点击或按住拖动激起涟漪，按 `1`–`4` 切换材质

无第三方图形库，只有 Vite + TypeScript + 原生 WebGL2。

## 本地运行

```bash
npm install
npm run dev      # http://localhost:47193
npm run build    # 产物在 dist/
```

着色器源码在 `src/shader.ts`，交互与渲染循环在 `src/main.ts`。
