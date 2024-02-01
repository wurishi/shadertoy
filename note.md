[shadertoy](https://www.shadertoy.com)

| 类型      | 名称                  | 描述                                                         |
| --------- | --------------------- | ------------------------------------------------------------ |
| vec3      | iResolution           | 视口分辨率 (z 为 像素对应的实际像素, 默认为1)                |
| float     | iTime                 | 当前时间 (秒)                                                |
| float     | iTimeDelta            | Time it takes to render a frame, in seconds                  |
| int       | iFrame                | Current frame                                                |
| float     | iFrameRate            | Number of frames rendered per second                         |
| float     | iChannelTime[4]       | Time for channel (if video or sound), in seconds             |
| vec3      | iChannelResolution[4] | Input texture resolution for each channel                    |
| vec4      | iMouse                | xy = current pixel coords (if LMB is down). zw = click pixel |
| sampler2D | iChannel{i}           | Sampler for input textures i                                 |
| vec4      | iDate                 | Year, month, day, time in seconds in .xyzw                   |
| float     | iSampleRate           | The sound sample rate (typically 44100)                      |

`gl_FragCoord`

![webgl-pixels](assets/webgl-pixels.png)

```bash
# 首次运行先生成 dll
npx webpack --config webpack.dll.config.js
# 开启 webpack 测试服务器
npx webpack-dev-server
```

# GLSL - API

| Syntax                                                       | Description                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| genType **pow**(genType x, genType y)                        | x的y次方. **如果x小于0, 结果为 undefined. 如果x=0且y<=0, 结果也是 undefined.** |
| genType **dFdx**(genType p)                                  | 偏导数. GPU 会同时跑片元着色器的多个实例, 但并不是一个像素一个像素去执行的. 而是会组织在2x2的一组pixels块中并行执行. 偏导数就是通过像素块中变量的差值(变化率)而计算出来的. dFdx 表示的是像素块中右边像素的值减去左边像素的值 |
| genType **dFdy**(genType p)                                  | 下面像素的值减去上面像素的值.                                |
| genType **fract**(genType x)                                 | 返回 x 的小数部分.                                           |
| genType **clamp**(genType x, genType minVal, genType maxVal) | 夹具函数, 取三个参数中中间值. **如果 minVal > maxVal, 返回 undefined.** |
|                                                              |                                                              |
|                                                              |                                                              |
|                                                              |                                                              |
|                                                              |                                                              |



# 1. Fovea detector

4dsXzM

![1](assets/1.png)

# 2. yonatan fractal

tlyfzt

![2](assets/2.jpg)

# 3. Trig-less Hash

WlyBRd

![3](assets/3.jpg)

# 4. Creation by Silexars

XsXXDn

![4](assets/4.jpg)

# 5. tiny

tiny

![5](assets/5.jpg)

# 6. Flame

MdX3zr

![6](assets/6.jpg)

# 7. Star Nest

XlfGRj

![7](assets/7.jpg)

# 8. Fractal Land

XsBXWt

![8](assets/8.jpg)

# 9. Curvature - Parametric 3D

XlfXR4

![9](assets/9.jpg)

# 10. Elephant Ear Plants

XsVGzm

![10](assets/10.jpg)

# 11. Isopleth

Mllfzl

![11](assets/11.jpg)

# 12. Alloy Plated Voronoi

XdfyWM

![12](assets/12.jpg)

# 13. Voronoi - smooth

ldB3zc

![13](assets/13.jpg)

# 14. Seascape

Ms2SD1

![14](assets/14.jpg)

# 15. Mystify Screensaver

MsKcRh

# 16. Ray Marching: Part 6

4tcGDr

![16](assets/16.jpg)

# 17. HCL Color Range

MtjBWR

![17](assets/17.png)

# 18. Very fast procedural ocean

MdXyzX

![18](assets/18.jpg)

# 19. Planet #2

fdX3zr

![19](assets/19.jpg)

# 20. Liberation of the True Self

tlGfzd

![20](assets/20.jpg)

# 21. neuron 1512 "lol"

fdlGRH

![21](assets/21.jpg)

# 22. Synthesis ideas

WlycRW

![22](assets/22.png)

# 23. Fork MANO fract NikolaErce 337

sdX3zH

![23](assets/23.jpg)

# 24. Fork Analys Cub NikolaErce 538

sdfGzH

![24](assets/24.png)

# 25. Cellular noise collection

tlcBDs

![25](assets/25.png)

# 26. font zoom explorer

NsXGz8

![26](assets/26.png)

# 27. Layer Slice display

NdX3RH

![27](assets/27.png)

# 28. ANU - Strategic Management

sdX3Rr

![28](assets/28.jpg)

# 29. Fractal 38_gaz

fdfGR8

![29](assets/29.jpg)

# 30. Tidal

NdXGRr

![30](assets/30.png)

# 31. fractal pyramid

tsXBzS

![31](assets/31.jpg)

# 32. Neural Stanford Bunny (5 kb)

wtVyWK

![32](assets/32.jpg)

# 33. CineShader Lava

3sySRK

![33](assets/33.jpg)

# 34. Cyber Fuji 2020

Wt33Wf

![34](assets/34.jpg)

# 35. Phantom Star for CineShader

ttKGDt

![35](assets/35.jpg)

# 36. DVD Bounce

wtcSzN

![36](assets/36.jpg)

# 37. CineShader Test

wlVGWd

![37](assets/37.jpg)

# 38. FWA logo

tt3XDn

![38](assets/38.jpg)

# 39. Octagrams

tlVGDt

![39](assets/39.jpg)

# 40. Planetary Soup

ttKBDd

![40](assets/40.jpg)

# 41. Base warp fBM

tdG3Rd

![41](assets/41.jpg)

# 42. Prism sdf,test

tlyBW3

![42](assets/42.jpg)

# 43. GLSL ray tracing test

3sc3z4

![43](assets/43.jpg)

# 44. Happy Jumping

3lsSzf

![44](assets/44.jpg)

# 45. Bandlimited Synthesis 1

WtScDt

![45](assets/45.jpg)

# 46. Raymarching - Primitives

Xds3zN

![46](assets/46.jpg)

# 47. Plasma Globe

XsjXRm

![47](assets/47.jpg)

# 48. Clouds

XslGRr

![48](assets/48.jpg)

# 49. Auroras

XtGGRt

![49](assets/49.jpg)

# 50. IQ_TUT: Greek Holiday 2021

fdl3z8

![50](assets/50.jpg)

# 51. stretching white vs blue noise

fdsGz8

![51](assets/51.png)

# 52. Fractal 39_gaz

sss3R8

![52](assets/52.jpg)

# 53. Pencilvester's orthodoodle

wlyfWK

![53](assets/53.jpg)

# 54. Extruded Truchet Pattern

ttVBzd

![54](assets/54.jpg)

# 55. Faux Layered Extrusion

Wsc3Ds

![55](assets/55.jpg)

# 56. 4.8^2 Truchet

MlyBRG

![56](assets/56.jpg)

# 57. Snail

ld3Gz2

![57](assets/57.jpg)

# 58. 3d simplex noise

XsX3zB

![58](assets/58.jpg)

# 59. Noise Lab (3D)

4sc3z2

![59](assets/59.jpg)

# 60. Hash without Sine

4djSRW

![60](assets/60.jpg)

# 61. 4.6.12 Truchet

llyBRG

![61](assets/61.jpg)

# 62. 4.6.12 Truchet Weave

WsyXWR

![62](assets/62.jpg)

# 63. Diamond Octagon Truchet Pattern

wdBSRm

![63](assets/63.jpg)

# 64. Hologram Boxes

3tX3R4

![64](assets/64.jpg)

# 65. 4.8^2 Truchet Weave

3dVSRm

![65](assets/65.jpg)

# 66. Integer Hash - I

llGSzw

![66](assets/66.jpg)

# 67. Integer Hash - II

XlXcW4

![67](assets/67.jpg)

# 68. Integer Hash - III

4tXyWN

![68](assets/68.jpg)

# 69. Filtered grid (box, 2D)

XtBfzz

![69](assets/69.jpg)

# 70. filtered checker (box, 2D)

XlcSz2

![70](assets/70.jpg)

# 71. Filtered checker (box, 3D)

XlXBWs

![71](assets/71.jpg)

# 72. Filtered checker (triangle, 3D)

llffWs

![72](assets/72.jpg)

# 73. Filtered xor (box, 2D)

tdBXRW

![73](assets/73.jpg)

# 74. Integrating a square wave

MtffWs

![74](assets/74.png)

# 75. Phantom Mode

MtScWW

![75](assets/75.jpg)or![75-1](assets/75-1.jpg)

# 76. Palettes

ll2GD3

![76](assets/76.jpg)

# 77. Bandlimited Synthesis 2

wtXfRH

![77](assets/77.jpg)

# 78. Bandlimited fbm (box, 2D)

3tScWd

![78](assets/78.jpg)

# 79. webgl2 grid noise

4tfyW4

![79](assets/79.jpg)

# 80. Noise animation - 3D

XdfXRj

![80](assets/80.jpg)

# 81. Noise - Value - 2D - Deriv

4dXBRH

![81](assets/81.jpg)

# 82. Analytic Normals 2D

MdsSRs

![82](assets/82.jpg)

# 83. Noise - Gradient - 2D - Deriv

XdXBRH

![83](assets/83.jpg)

# 84. Noise - Value - 3D - Deriv

XsXfRH

![84](assets/84.jpg)

# 85. Noise - Gradient - 3D - Deriv

4dffRH

![85](assets/85.jpg)

# 86. Noise - value - 2D

lsf3WH

![86](assets/86.jpg)

# 87. Noise - gradient - 2D

XdXGW8

![87](assets/87.jpg)

# 88. Noise - value - 3D

4sfGzS

![88](assets/88.jpg)

# 89. Noise - gradient - 3D

Xsl3Dl

![89](assets/89.jpg)

# 90. Noise - simplex - 2D

Msf3WH

![90](assets/90.jpg)

# 91. Noise - wave - 2D

tldSRj

![91](assets/91.jpg)

# 92. interesting noise algorithm

wttSRj

![92](assets/92.jpg)

# 93. Analytic Normals 3D

XttSz2

![93](assets/93.jpg)

# 94. Voronoise

Xd23Dh

![94](assets/94.jpg)

# 95. Voronoi - distances

ldl3W8

![95](assets/95.jpg)

# 96. Voronoi - hierarchical

Xll3zX

![96](assets/96.jpg)

# 97. Fractal 43_gaz

sssGWS

![97](assets/97.jpg)

# 98. 7dsGWS

7dsGWS

![98](assets/98.jpg)

# 99. Parallax view on Cineshader

wtdSR8

![99](assets/99.jpg)

# 100. Will it blend

lsdGzN

![100](assets/100.jpg)

# 101. 3d color space visualization

XddGRN

![101](assets/101.jpg)

# 102. Smooth HSV

MsS3Wc

![102](assets/102.jpg)

# 103. Cube lines

NslGRN

![103](assets/103.jpg)

# 104. Bilinear Patch - intersection

ltKBzG

![104](assets/104.jpg)

# 105. Strange Crystal

tsVXzh

![105](assets/105.jpg)

# 106. Tubularity

WlffDn

![106](assets/106.jpg)

# 107. Box - fake soft shadow

WslGz4

![107](assets/107.jpg)

# 108. BUG Nvidia const to array

NslGR4

bug tested and works Nvidia 960 and 750, OpenGL and Vulkan

# 109. Box - intersection

ld23DV

![109](assets/109.jpg)

# 110. Goursat - intersection

3lj3DW

![110](assets/110.jpg)

# 111. Sphere4 - intersection

3tj3DW

![111](assets/111.jpg)

# 112. Parallelogram - intersection

4tlBDs

![112](assets/112.jpg)

# 113. Quad - intersection

XtlBDs

![113](assets/113.jpg)

# 114. Triangle - intersection

MlGcDz

![114](assets/114.jpg)

# 115. Torus - intersection

4sBGDy

![115](assets/115.jpg)

# 116. Rounded Cone - intersection

MlKfzm

![116](assets/116.jpg)

# 117. Rounded Box - intersection

WlSXRW

![117](assets/117.jpg)

# 118. Disk - intersection

lsfGDB

![118](assets/118.jpg)

# 119. Cone - intersection

llcfRf

![119](assets/119.jpg)

# 120. Capsule - intersection

Xt3SzX

![120](assets/120.jpg)

# 121. Box - occlusion clipping

4sSXDV

![121](assets/121.jpg)

# 122. Box - occlusion

4djXDy

![122](assets/122.jpg)

# 123. Triangle - occlusion

XdjSDy

![123](assets/123.jpg)

# 124. Sphere - occlusion

4djSDy

![124](assets/124.jpg)

# 125. Ellipsoid - occlusion

MlsSzn

![125](assets/125.jpg)

# 126. Capsule - occlusion

llGyzG

![126](assets/126.jpg)

# 127. Capsule - bounding box

3s2SRV

![127](assets/127.jpg)

# 128. Box - fog density

Ml3GR8

![128](assets/128.jpg)

# 129. Sphere - fog density

XljGDy

![129](assets/129.jpg)

# 130. Box - gradient 2D

wlcXD2

![130](assets/130.jpg)

# 131. Stained Lights

WlsSzM

![131](assets/131.jpg)

# 132. Brush Experiment 3

ltj3Wc

![132](assets/132.jpg)

# 133. Rainier mood

ldfyzl

![133](assets/133.jpg)

# 134. Texture - Better Filtering

XsfGDn

![134](assets/134.jpg)

# 135. Warping - procedural 2

lsl3RH

![135](assets/135.jpg)

# 136. (no Music) - Pirates

ldXXDj

![136](assets/136.jpg)

# 137. [SIG2014] - Total Noob

XdlSDs

![137](assets/137.jpg)

# 138. edge glow

Mdf3zr

视频在网盘 shadertoy.zip

![138](assets/138.jpg)

# 139. I/O

XsfGDS

![139](assets/139.jpg)

# 140. Brush Experiment 2

lt23D3

![140](assets/140.jpg)

# 141. Brush Smear

Xt2GWc

![141](assets/141.jpg)

# 142. Grid Paper (+mouse)

4tj3DG

![142](assets/142.jpg)

# 143. 2pic

![143](assets/143.jpg)

# 144. 38911 BASIC BYTES FREE

MljGWG

![144](assets/144.jpg)

# 145. Pixellated Plasma + mouse

4tjGWy

![145](assets/145.jpg)

# 146. Floyd-Steinberg Dithering WIP

Xst3W7

![146](assets/146.jpg)

# 147. 2D Primitive Distance Functions

XtjGzt

![147](assets/147.jpg)

# 148. Hex Master 140ch

ltlSW4

![148](assets/148.jpg)

# 149. Palette Quantization & Dithering

4ddGWr

![149](assets/149.jpg)

# 150. Distance field drawing methods

ltBGzt

![150](assets/150.jpg)

# 151. Quantization & Dithering 2

Xdt3Wr

![151](assets/151.jpg)

# 152. Palettization + OrderedDithering

Xdt3Dr

![152](assets/152.jpg)

# 153. website background #2

4st3DS

![153](assets/153.jpg)

# 154. Neon Hypno Bands

MdcGW4

![154](assets/154.jpg)

# 155. Backyard Starleaves

Mdyyzt

![155](assets/155.jpg)

# 156. Time-o-matic

MlfXz8

![156](assets/156.jpg)

# 157. Keep up little square

wlsXD2

![157](assets/157.jpg)

# 158. Donuts can be beautiful too

wtfSW8

![158](assets/158.jpg)

# 159. Disk - bounding box

ll3Xzf

![159](assets/159.jpg)

# 160. Cylinder - bounding box

MtcXRf

![160](assets/160.jpg)

# 161. Ellipse - bounding box

Xtjczw

![161](assets/161.jpg)

# 162. Cone - bounding box

WdjSRK

![162](assets/162.jpg)

# 163. Cubic Bezier - 2D BBox

XdVBWd

![163](assets/163.jpg)

# 164. Quadratic Bezier - 3D

ldj3Wh

![164](assets/164.jpg)

# 165. Quadratic Bezier - 2D BBox

lsyfWc

![165](assets/165.jpg)

# 166. Box occlusion optimized

ttlBWf

![166](assets/166.jpg)

# 167. HexTile Truchet Marching

WlByW3

![167](assets/167.jpg)

# 168. Unstable Universe

wtlfz8

![168](assets/168.jpg)

# 169. Clooud City

tt3Bz2

![169](assets/169.jpg)

# 170. RME4 - Crater

MlSBDt

![170](assets/170.jpg)

# 171. Purple Haze

XdSGWy

![171](assets/171.jpg)

# 172. Sphere - soft shadow

4d2XWV

![172](assets/172.jpg)

# 173. Triangulated Heightfield Trick

XlcBRX

![173](assets/173.jpg)

# 174. Balls and shadows

lsSSWV

![174](assets/174.jpg)

# 175. Repelling

XdjXWK

![175](assets/175.jpg)

# 176. Ellipsoid - soft shadow

llsSzn

![176](assets/176.jpg)

# 177. Capsule - soft shadow

MlGczG

![177](assets/177.jpg)

# 178. Cylinder - intersection

4lcSRn

![178](assets/178.jpg)

# 179. Hexprism - intersection

tljBWy

![179](assets/179.jpg)

# 180. Hexagonal Grid Traversal - 3D

WtSfWK

![180](assets/180.jpg)

# 181. Cylinder - distance

wdXGDr

![181](assets/181.jpg)

# 182. Cone - distance

tsSXzK

![182](assets/182.jpg)

# 183. Hexagonal Grid Traversal - 2D

WtSBWK

![183](assets/183.jpg)

# 184. Quadratic Bezier Stroke

XsX3zf

![184](assets/184.jpg)

# 185. Cubic Bezier - 3D BBox

MdKBWt

![185](assets/185.jpg)

# 186. Quadratic Bezier - 3D BBox

tsBfRD

![186](assets/186.jpg)

# 187. Bezier - Signed Distance

ltXSDB

![187](assets/187.jpg)

# 188. Magic Fractal

4ljGDd

![188](assets/188.jpg)

# 189. Hexagons - distance

Xd2GR3

![189](assets/189.jpg)

# 190. Triangle - distance 3D

4sXXRN

![190](assets/190.jpg)

# 191. Triangle - closest

ttfGWl

![191](assets/191.jpg)

# 192. BUG Nvidia const to array min

Ndl3zr

bug Nvidia 750 OpenGL

# 193. 1D, 2D & 3D Value Noise

4dS3Wd

![193](assets/193.jpg)

# 194. Triangle - distance 2D

XsXSz4

![194](assets/194.jpg)

# 195. Triangle - Gradient Boundaries

tlKcDz

![195](assets/195.jpg)

# 196. Quad - Gradient Boundaries

WlycWh

![196](assets/196.jpg)

# 197. Inverse Bilinear

lsBSDm

![197](assets/197.jpg)

# 198. Day 61

WlKXRR

![198](assets/198.jpg)

# 199. Circle - gradient 2D

WltSDj

![199](assets/199.jpg)

# 200. Subsurface lattice

wljSz1

![200](assets/200.jpg)

# 201. raymarching

tlKBRd

![201](assets/201.jpg)

# 202. Fractal 35_gaz

wtKBRd

![202](assets/202.jpg)

# 203. Tetrahedral Voxel Traversal

wtfXWB

![203](assets/203.jpg)

# 204. Rotating donut

fsSGWy

![204](assets/204.jpg)

# 205. Simple DoF

wsXBRf

![205](assets/205.jpg)

# 206. Red Crash - Procedural GFX

ssBGRG

![206](assets/206.jpg)

# 207. Verlet Spider!

ltjXzt

![207](assets/207.jpg)

# 208. Fruxis (made in 2012)

ldl3zl

![208](assets/208.jpg)

# 209. Soul - 22

NsjGRt

![209](assets/209.jpg)

# 210. You Are Here

fdSGRy

![210](assets/210.jpg)

# 211. Fractal 51_gaz

7sB3Dy

![211](assets/211.jpg)

# 212. Spout

lsXGzH

![212](assets/212.jpg)

# 213. Pie - gradient 2D

3tGXRc

![213](assets/213.jpg)

# 214. Arc - gradient 2D

WtGXRc

![214](assets/214.jpg)

# 215. Isosceles Triangle - gradient 2D

3dyfDd

![215](assets/215.jpg)

# 216. Triangle - gradient 2D

tlVyWh

![216](assets/216.jpg)

# 217. Quad - gradient 2D

WtVcD1

![217](assets/217.jpg)

# 218. Cross - gradient 2D

WtdXWj

![218](assets/218.jpg)

# 219. Segment - gradient 2D

WtdSDj

![219](assets/219.jpg)

# 220. Hexagon - gradient 2D

WtySRc

![220](assets/220.jpg)

# 221. Vesica - gradient 2D

3lGXRc

![221](assets/221.jpg)

# 222. Smooth Minimum - gradient 2D

tdGBDt

![222](assets/222.jpg)

# 223. Parallelogram - gradient 2D

sssGzX

![223](assets/223.jpg)

# 224. Shaderdough

4tc3WB

![224](assets/224.jpg)

# 225. HG SDF in WebGL

Xs3GRB

![225](assets/225.jpg)

# 226. Icosahedron twist

Mtc3RX

![226](assets/226.jpg)

# 227. SDF Tutorial 1 : box & balloon

Xl2XWt

![227](assets/227.jpg)

# 228. Remnant X

4sjSW1

![228](assets/228.jpg)

# 229. Cloud Ten

XtS3DD

![229](assets/229.jpg)

# 230. Spectacles

4lBXWt

![230](assets/230.jpg)

# 231. Voxel Edges

4dfGzs

![231](assets/231.jpg)

# 232. [NV15] Space Curvature

llj3Rz

![232](assets/232.jpg)

# 233. Menger Sponge

4sX3Rn

![233](assets/233.jpg)

# 234. Monster

4sX3R2

![234](assets/234.jpg)

# 235. Ladybug

4tByz3

![235](assets/235.jpg)

# 236. Hell

MdfGRX

![236](assets/236.jpg)

# 237. Mandelbrot - distance

lsX3W4

![237](assets/237.jpg)

# 238. Flames

MsXGRf

![238](assets/238.jpg)

# 239. Storm

Xd23zh

![239](assets/239.jpg)

# 240. Heart - 2D

XsfGRn

![240](assets/240.jpg)

# 241. Demo - Volumetric Lines

4slGz4

![241](assets/241.jpg)

# 242. Fish swimming

ldj3Dm

![242](assets/242.jpg)

# 243. Woods

XsfGD4

![243](assets/243.jpg)

# 244. Bubbles

4dl3zn

![244](assets/244.jpg)

# 245. Warping - procedural 1

4s23zz

![245](assets/245.jpg)

# 246. Warping - procedural 4

MdSXzz

![246](assets/246.jpg)

# 247. Arlo

4dtGWM

![247](assets/247.jpg)

# 248. Texture variation II

lt2GDd

![248](assets/248.jpg)

# 249. Bender

4slSWf

![249](assets/249.jpg)

# 250. Analytic Motionblur 2D

MdSGDm

![250](assets/250.jpg)

# 251. Parametric graph by curvature

Xlf3zl

![251](assets/251.jpg)

# 252. Heart - 3D

4lK3Rc

![252](assets/252.jpg)

# 253. Flower

4dlGD7

![253](assets/253.jpg)

# 254. Input - Time

lsXGz8

![254](assets/254.jpg)

# 255. Radial Blur

4sfGRn

![255](assets/255.jpg)

# 256. Image - Audrey

4df3D8

![256](assets/256.jpg)

# 257. Warping - texture

Xsl3zn

![257](assets/257.jpg)

# 258. Deform - holes

4sXGzn

![258](assets/258.jpg)

# 259. Weird Thing

XsB3Wc

![259](assets/259.jpg)

# 260. Fourier - interpolation

4lGSDw

![260](assets/260.jpg)

# 261. Sierpinski - 3D

4dl3Wl

![261](assets/261.jpg)

# 262. Sunset

XssSRX

![262](assets/262.jpg)

# 263. Stairway to Heaven Curve

4tfGRl

![263](assets/263.jpg)

# 264. Xyptonjtroz

4ts3z2

![264](assets/264.jpg)

# 265. The Gallery

XsSSzG

![265](assets/265.jpg)

# 266. Cheap curvature

Xts3WM

![266](assets/266.jpg)

# 267. Input - Mouse

Mss3zH

![267](assets/267.jpg)

# 268. Input - TimeDelta & FPS

lsKGWV

![268](assets/268.png)

# 269. Numbers

4sf3RN

![269](assets/269.png)

# 270. Smaller Numbers

4sBSWW

![270](assets/270.png)

# 271. Prints Numbers

lt3GRj

![271](assets/271.png)

# 272. Fork Creation S gusandr 800

ssXXzn

![272](assets/272.jpg)

# 273. Texture variation I

4tsGzf

![273](assets/273.jpg)

# 274. digits/sliders/kbd widgets - 2

MdKGRw

![274](assets/274.jpg)

# 275. digits/sliders/kbd widgets

lsXXzN

![275](assets/275.png)

# 276. Digital clock

MdfGzf

![276](assets/276.png)

# 277. 7 segment display (wip)

3dtSRj

![277](assets/277.jpg)

# 278. Polyhedron DE

XtXGRS

![278](assets/278.jpg)

# 279. Umbrellar

4t2SRh

![279](assets/279.jpg)

# 280. Tribute - Journey!

ldlcRf

![280](assets/280.jpg)

# 281. Elevated

MdX3Rr

![281](assets/281.jpg)

# 282. TextCandy

4sfGRH

![282](assets/282.jpg)

# 283. GLOW TUTORIAL

3s3GDn

![283](assets/283.jpg)

# 284. Blackbody Lava

MdBSRW

![284](assets/284.jpg)

# 285. Spectral Power Distribution

lsKczc

![285](assets/285.jpg)

# 286. Days 480

7sXSz8

![286](assets/286.jpg)

# 287. Test font spacing

MsfyDN

![287](assets/287.png)

# 288. HSV and HSL

lsS3Wc

![288](assets/288.jpg)

# 289. Flowing Lava

4djSzR

![289](assets/289.jpg)

# 290. Triangulated Heightfield Trick 2

tlXSzB

![290](assets/290.jpg)

# 291. Triangulated Heightfield Trick 3

ttsSzX

![291](assets/291.jpg)

# 292. [SH17C] Surface Mesh Generation

MdSBRc

![292](assets/292.jpg)

# 293. [2TC 15] Mystery Mountains

llsGW7

![293](assets/293.jpg)

# 294. box & balloon Minimized

Xt2XDt

![294](assets/294.jpg)

# 295. Sirenian Dawn

XsyGWV

![295](assets/295.jpg)

# 296. Noise animation - Electric

ldlXRS

![296](assets/296.jpg)

# 297. Ether

MsjSW3

![297](assets/297.jpg)

# 298. Noise animation - Flow

MdlXRS

![298](assets/298.jpg)

# 299. Noise animation - Lava

lslXRS

![299](assets/299.jpg)

# 300. Fancy ties

ltfGDs

![300](assets/300.jpg)

# 301. Fake glints

Md2Xzm

![301](assets/301.jpg)

# 302. Magnetismic

XlB3zV

![302](assets/302.jpg)

# 303. Fast edge detection

4s2XRd

![303](assets/303.jpg)

# 304. Postcard

XdBSWd

![304](assets/304.jpg)

# 305. Artistic shading

Xtj3Dm

![305](assets/305.jpg)

# 306. Promethean

4tB3zV

![306](assets/306.jpg)

# 307. Spherical polyhedra

4dBXWD

![307](assets/307.jpg)

# 308. Sparse grid marching

XlfGDs

![308](assets/308.jpg)

# 309. Overly satisfying

Mts3zM

![309](assets/309.jpg)

# 310. Flaring

lsSGzy

![310](assets/310.jpg)

# 311. Re-entry

4dGyRh

![311](assets/311.jpg)

# 312. Dynamism

MtKSWW

![312](assets/312.jpg)

# 313. Hyperlepsy

4lB3WV

![313](assets/313.jpg)

# 314. Noise animation - Watery

MssSRS

![314](assets/314.jpg)

# 315. String theory

XdSSz1

![315](assets/315.jpg)

# 316. Graphing

MdjGRy

![316](assets/316.jpg)

# 317. Neon parallax

XssXz4

![317](assets/317.jpg)

# 318. Somewhere in 1993

Md2XDD

![318](assets/318.jpg)

# 319. Music toolbox

MdfXW2

![319](assets/319.jpg)

# 320. [2TC 15]2 Tweets Challenge

4tl3W8

![320](assets/320.jpg)

# 321. Pustules

XdSXDc

![321](assets/321.jpg)

# 322. Curvature average

XsfXzs

![322](assets/322.jpg)

# 323. Oblivion

XtX3DH

![323](assets/323.jpg)

# 324. Volumetric Helices

4sfXDs

![324](assets/324.jpg)

# 325. Sphere mappings

4sjXW1

![325](assets/325.jpg)

# 326. Quality hashes collection WebGL2

Xt3cDn

![326](assets/326.jpg)

# 327. Cairo tiling

4ssSWf

![327](assets/327.jpg)

# 328. [2TC 15]Results

Mtf3Rj

![328](assets/328.jpg)

# 329. Koch Snowflake again

Mlf3RX

![329](assets/329.jpg)

# 330. Shadertoy Discord server

tljGDh

![330](assets/330.jpg)

# 331. Satellite's eye

4tX3Ws

![331](assets/331.jpg)

# 332. Colorful tessellation

lslXDn

![332](assets/332.jpg)

# 333. [2TC 15]Judging Begins

llXGzB

![333](assets/333.jpg)

# 334. Checkerboard reconstruction

llXfzf

![334](assets/334.jpg)

# 335. Parallax mapping

4lSGRh

![335](assets/335.jpg)

# 336. Cathode

4lXcDH

![336](assets/336.jpg)

# 337. Piecewise dragon

lsS3DD

![337](assets/337.jpg)

# 338. HURA generator

MtlXD8

![338](assets/338.png)

# 339. Day at the Lake

wl3czN

![339](assets/339.jpg)

# 340. Myrror

XtdGDB

![340](assets/340.jpg)

# 341. Triangulator

lllGRr

![341](assets/341.jpg)

# 342. Derivative based AA

4sfSzf

![342](assets/342.jpg)

# 343. Affine arithmetic 3d

lsfXzj

![343](assets/343.jpg)

# 344. Moon voxels

tdlSR8

![344](assets/344.jpg)

# 345. Cheap orthonormal basis

4sSSW3

![345](assets/345.jpg)

# 346. 2D Voxels

4slXW7

![346](assets/346.jpg)

# 347. Famous solid

ltlGWM

![347](assets/347.jpg)

# 348. Orbit Noise

4t3yDn

![348](assets/348.jpg)

# 349. Procedural Ordering

4dsXzj

![349](assets/349.jpg)

# 350. Parametrics

XdSSRw

![350](assets/350.jpg)

# 351. C64 Simulation

Mll3DH

![351](assets/351.jpg)

# 352. Discs?

XslSWH

![352](assets/352.jpg)

# 353. 3d Graphing

lsSXRD

![353](assets/353.jpg)

# 354. Cheap Bezier palettes

MlVBDR

![354](assets/354.jpg)

# 355. MandelOct

wlcfR8

![355](assets/355.jpg)

# 356. 2D Folding

4tX3DS

![356](assets/356.jpg)

# 357. Bit Packed Sprites

XtsGRl

![357](assets/357.png)

# 358. Paper Kaleidoscope

ls3GRr

![358](assets/358.jpg)

# 359. Yellow Manypus

ltB3RK

![359](assets/359.jpg)

# 360. Superior easing

ltBGDD

![360](assets/360.jpg)

# 361. Polyhedron again

XlX3zB

![361](assets/361.jpg)

# 362. Honeycomb Pattern

ltXGWS

![362](assets/362.jpg)

# 363. Bicubic/Biquadratic noise

XlVcWV

![363](assets/363.jpg)

# 364. Filter reference

XtVcWc

![364](assets/364.jpg)

# 365. Efficient Barycentric

lslXDf

![365](assets/365.jpg)

# 366. Interval Arithmetic

lssSWH

![366](assets/366.jpg)

# 367. 2D Vector Graphics Library

lslXW8

![367](assets/367.jpg)

# 368. Ellipse - distance 2D

4sS3zz

![368](assets/368.jpg)

# 369. Ellipse - distance 2D II

4lsXDN

![369](assets/369.jpg)

# 370. Ellipse - distance 2D II No Trig

tttfzr

![370](assets/370.jpg)

# 371. Ellipse - SDF (trigless, 3 iter)

tt3yz7

![371](assets/371.jpg)

# 372. Ellipse Distance Comparison

wtfyWj

![372](assets/372.jpg)

# 373. Pablo

fdfXDH

![373](assets/373.jpg)

# 374. Onewarp

3dVczw

![374](assets/374.jpg)

# 375. Fork UniverseWi JulianCode 354

7sXSz4

![375](assets/375.jpg)

# 376. Ellipse - Distance III

MtXXW7

![376](assets/376.jpg)

# 377. Log-Bisection Tracing

4sSXzD

![377](assets/377.jpg)

# 378. runes

MsXSRn

![378](assets/378.jpg)

# 379. Anisotropic Highlights

XdB3DG

![379](assets/379.jpg)

# 380. Koch snowflake IFS

XsfXDH

![380](assets/380.jpg)

# 381. [2TC 15] old skool 3d driving

XtlGW4

![381](assets/381.jpg)

# 382. [2TC 15] Supernova

MtfGWN

![382](assets/382.jpg)

# 383. [2TC 15] Venus

llsGWM

![383](assets/383.jpg)

# 384. [2TC 15] Hall of kings

4tfGRB

![384](assets/384.jpg)

# 385. [2TC 15] Flying

4ts3DH

![385](assets/385.jpg)

# 386. [2TC 15] Night Forest

4lfGDM

![386](assets/386.jpg)

# 387. [2TC 15] Cave

ltlGDN

![387](assets/387.jpg)

# 388. [2TC 15] Minecraft

4tsGD7

![388](assets/388.jpg)

# 389. Tokyo

Xtf3zn

![389](assets/389.jpg)

# 390. Misty Lake

MsB3WR

![390](assets/390.jpg)

# 391. Voxel Ambient Occlusion

ldl3DS

![391](assets/391.jpg)

# 392. cheap sky simulation

ttSGzh

![392](assets/392.jpg)

# 393. Canyon

MdBGzG

![393](assets/393.jpg)

# 394. 1D Quadratic Dual Interpolation

WtXSR7

![394](assets/394.jpg)

# 395. Tone mapping

lslGzl

![395](assets/395.jpg)

# 396. Simplest Fastest 2D Hash

MdcfDj

![396](assets/396.jpg)

# 397. Toolbox of Noisey Goodness

4dVBzz

![397](assets/397.jpg)

# 398. 2D Weyl hash #1 (integer)

MsV3z3

![398](assets/398.jpg)

# 399. 2D Weyl hash 32-bit XOR

4dlcR4

![399](assets/399.jpg)

# 400. Hash without Sine 2 (WebGL 2)

XdGfRR

![400](assets/400.jpg)

# 401. Watercolor painting

NdsXRB

![401](assets/401.jpg)

# 402. hash: visualising bitplanes

lt2yDm

![402](assets/402.jpg)

# 403. Terrain Tubes

4sjXzG

![403](assets/403.jpg)

# 404. Protean clouds

3l23Rh

![404](assets/404.jpg)

# 405. Rainforest

4ttSWf

![405](assets/405.jpg)

# 406. Rhodium liquid carbon

llK3Dy

![406](assets/406.jpg)

# 407. Simplicity Galaxy

MslGWN

![407](assets/407.jpg)

# 408. Main Sequence Star

4dXGR4

![408](assets/408.jpg)

# 409. Playing marble

MtX3Ws

![409](assets/409.jpg)

# 410. The Drive Home

MdfBRX

![410](assets/410.jpg)

# 411. Heartfelt

ltffzl

![411](assets/411.jpg)

# 412. GLSL 2D Tutorials

Md23DV

![412](assets/412.jpg)

# 413. 2D Clouds

4tdSWr

![413](assets/413.jpg)

# 414. Cubescape

Msl3Rr

![414](assets/414.jpg)

# 415. notebook drawings

XtVGD1

![415](assets/415.jpg)

# 416. Goo

lllBDM

![416](assets/416.jpg)

# 417. VolumetricIntegration

XlBSRz

![417](assets/417.jpg)

# 418. Cloudy Terrain

MdlGW7

![418](assets/418.jpg)

# 419. Perspex Web Lattice

Mld3Rn

![419](assets/419.jpg)

# 420. Volumetric explosion

lsySzd

![420](assets/420.jpg)

# 421. Supernova remnant

MdKXzc

![421](assets/421.jpg)

# 422. Cheap Cloud Flythrough

Xsc3R4

![422](assets/422.jpg)

# 423. Cloudy spikeball

MljXDw

![423](assets/423.jpg)

# 424. Sample Pinning

XdfXzn

![424](assets/424.jpg)

# 425. FakeVolumetricClouds

XlsXzN

![425](assets/425.jpg)

# 426. Emission clouds

ltBXDm

![426](assets/426.jpg)

# 427. Charmap

ldSBzd

![427](assets/427.jpg)

# 428. Ball Of Fire

lsf3RH

![428](assets/428.jpg)

# 429. The wave

lsj3Dw

![429](assets/429.jpg)

# 430. Hash Functions for GPU Rendering

XlGcRh

![430](assets/430.jpg)

# 431. Modified FNV-1A hash

WtdfRX

![431](assets/431.jpg)

# 432. "Best" Integer Hash

WttXWX

![432](assets/432.jpg)

# 433. Simplicity 3d

ls2SDd

![433](assets/433.jpg)

# 434. Adaptive Sampling Diagram

llXSD7

![434](assets/434.png)

# 435. Structured Vol Sampling

Mt3GWs

![435](assets/435.jpg)

# 436. Simplicity

lslGWr

![436](assets/436.jpg)

# 437. Dusty nebula 4

MsVXWW

![437](assets/437.jpg)

# 438. Dusty nebula 3

lsVSRW

![438](assets/438.jpg)

# 439. Protoplanetary disk

MdtGRl

![439](assets/439.jpg)

# 440. Dusty nebula 1

4lSXD1

![440](assets/440.jpg)

# 441. Alien Beacon

ld2SzK

![441](assets/441.jpg)

# 442. Anatomy of an explosion

Xss3DS

![442](assets/442.jpg)

# 443. Pyroclastic fireball

MtXSzS

![443](assets/443.jpg)

# 444. weaved Voronoï

ltsXRM

![444](assets/444.jpg)

# 445. UI easy to integrate

ldKSDm

![445](assets/445.jpg)

# 446. Structured Sampling Diagram

ll3GWs

![446](assets/446.png)

# 447. Rounded Box - distance 2D

4llXD7

![447](assets/447.jpg)

# 448. 96-bit 8x12 Font

Mt2GWD

![448](assets/448.jpg)

# 449. UI readable

XsySzG

![449](assets/449.jpg)

# 450. Abstract Corridor

MlXSWX

![450](assets/450.jpg)

# 451. Branchless Voxel Raycasting

4dX3zl

![451](assets/451.jpg)

# 452. Bumped Sinusoidal Warp

4l2XWK

![452](assets/452.jpg)

# 453. Geodesic tiling

llVXRd

![453](assets/453.jpg)

# 454. Skyline

XtsSWs

![454](assets/454.jpg)

# 455. plop

ltSSDV

![455](assets/455.jpg)

# 456. plop 2

MlSSDV

![456](assets/456.jpg)

# 457. Sculpture III

XtjSDK

![457](assets/457.jpg)

# 458. Lit Sine Warp

Ml2XDV

![458](assets/458.jpg)

# 459. hexagonal tiling

4d2GzV

![459](assets/459.jpg)

# 460. Buoy

XdsGDB

![460](assets/460.jpg)

# 461. [SH17C] Physically Based Shading

4sSfzK

![461](assets/461.jpg)

# 462. Bricks Game

MddGzf

![462](assets/462.jpg)

# 463. Tileable Water Caustic

MdlXz8

![463](assets/463.jpg)

# 464. 2d signed distance functions

4dfXDn

![464](assets/464.jpg)

# 465. Planet Shadertoy

4tjGRh

![465](assets/465.jpg)

# 466. [SIG15] Mario World 1-1

XtlSD7

![466](assets/466.jpg)

# 467. Generators

Xtf3Rn

![467](assets/467.jpg)

# 468. Spherical Harmonics lighting

lt2GRD

![468](assets/468.jpg)

# 469. Wet stone

ldSSzV

![469](assets/469.jpg)

# 470. Atmospheric Scattering Sample

lslXDr

![470](assets/470.jpg)

# 471. llamels

ltsGz4

![471](assets/471.jpg)

# 472. Lens Flare Example

4sX3Rs

![472](assets/472.jpg)

# 473. Flare Mania

lsBGDK

![473](assets/473.jpg)

# 474. Water world

lslGDB

![474](assets/474.jpg)

# 475. Floating Mountains

XsSGDy

![475](assets/475.jpg)

# 476. Clouds and Sun With Flare

4sl3zl

![476](assets/476.jpg)

# 477. musk's lens flare mod

XdfXRX

![477](assets/477.jpg)

# 478. Digital Brain

4sl3Dr

![478](assets/478.jpg)

# 479. furball

XsfGWN

![479](assets/479.jpg)

# 480. Where the River Goes

Xl2XRW

![480](assets/480.jpg)

# 481. Tiny Planet: Earth

lt3XDM

![481](assets/481.jpg)

# 482. Himalayas

MdGfzh

![482](assets/482.jpg)

# 483. Interstellar

Xdl3D2

![483](assets/483.jpg)

# 484. Shadertoy

lslGDn

![484](assets/484.jpg)



# 485. Hot Shower

4lf3Rj

![485](assets/485.jpg)

# 486. Mostly Harmless

MdsGzr

![486](assets/486.png)

# 487. VGA Mandelbrot

4lG3Wz

![487](assets/487.jpg)

# 488. Implicit Curve Example

Xds3Dn

![488](assets/488.png)

# 489. Volumetric Stanford Bunny

MdlyDs

![489](assets/489.jpg)

# 490. Humanoid Silhouettes

4scBWN

![490](assets/490.png)

# 491. jetstream

XlsGRs

![491](assets/491.jpg)

# 492. HOWTO: Ray Marching

XllGW4

![492](assets/492.jpg)

# 493. Noise Contour

MscSzf

![493](assets/493.png)

# 494. galaxy3

Xsl3zX

![494](assets/494.jpg)

# 495. Oceanic

4sXGRM

![495](assets/495.jpg)

# 496. Mountains

4slGD4

![496](assets/496.jpg)

# 497. Luminescence

4sXBRn

![497](assets/497.jpg)

# 498. sound - acid jam

ldfSW2

![498](assets/498.jpg)

# 499. The Universe Within

lscczl

![499](assets/499.jpg)

# 500. Super simple raymarching example

4dSBz3

![500](assets/500.jpg)

# 501. Crystal Skull

MsS3WV

![501](assets/501.jpg)

# 502. ray/cone & ray/frustum

4s23DR

![502](assets/502.jpg)

# 503. Hand-drawn Sketch

MsSGD1

![503](assets/503.jpg)

# 504. Flux Core

ltlSWf

![504](assets/504.jpg)

# 505. Empty Glass

4s2GDV

![505](assets/505.jpg)

# 506. Menger Journey

Mdf3z7

![506](assets/506.jpg)

# 507. Interactive thinks

Xt3SR4

![507](assets/507.jpg)

# 508. Glitch transform

XtyXzW

![508](assets/508.jpg)

# 509. Desert Canyon

Xs33Df

![509](assets/509.jpg)

# 510. Grid of Cylinders

4dSGW1

![510](assets/510.jpg)

# 511. Warped Extruded Skewed Grid

wtfBDf

![511](assets/511.jpg)

# 512. Abstract Glassy Field

4ttGDH

![512](assets/512.jpg)

# 513. Star Nursery

XsfGzH

![513](assets/513.jpg)

# 514. Apollonian

4ds3zn

![514](assets/514.jpg)

# 515. Fires

XsXSWS

![515](assets/515.jpg)

# 516. Neon Lit Hexagons

MsVfz1

![516](assets/516.jpg)

# 517. Greek Temple

ldScDh

![517](assets/517.jpg)

# 518. attic

Mdl3Rr

![518](assets/518.jpg)

# 519. Tree in the wind

tdjyzz

![519](assets/519.jpg)

# 520. [SH16B] Speed Drive 80

4ldGz4

![520](assets/520.jpg)

# 521. h e e e l i x

4sVczV

![521](assets/521.jpg)

# 522. Frozen wasteland

Xls3D2

![522](assets/522.jpg)

# 523. Noise blur

4dlGDN

![523](assets/523.jpg)

# 524. starDust

4sSSWz

![524](assets/524.jpg)

# 525. Then and Before - PC4k by Altair

3ddGzn

![525](assets/525.jpg)

# 526. Hexagonal Maze Flow

llSyDh

![526](assets/526.jpg)

# 527. Dolphin

4sS3zG

![527](assets/527.jpg)

# 528. doski canady

ldS3Wm

![528](assets/528.jpg)

# 529. Colored lines

tsBSWD

![529](assets/529.jpg)

# 530. Circuits

XlX3Rj

![530](assets/530.jpg)

# 531. Circle pattern

lss3Df

![531](assets/531.jpg)

# 532. Bokeh disc

4d2Xzw

![532](assets/532.jpg)

# 533. Cloud Phase function comparison

4sjBDG

![533](assets/533.png)

# 534. Helix Distance

MstcWs

![534](assets/534.jpg)

# 535. Soft Shadow Variation

lsKcDD

![535](assets/535.jpg)

# 536. Minimal Hexagonal Grid

Xljczw

![536](assets/536.jpg)

# 537. Wythoff construction

ldXczX

![537](assets/537.jpg)

# 538. FixingPixelArt

XsjSzR

![538](assets/538.jpg)

# 539. OTT

4sVyDd

![539](assets/539.jpg)

# 540. 43% Burnt

XljBWW

![540](assets/540.jpg)

# 541. Edge FXAA

MdyyRt

![541](assets/541.jpg)

# 542. Angle Grinder

XtsfWX

![542](assets/542.jpg)

# 543. Neon World

MlscDj

![543](assets/543.jpg)

# 544. Venice

MdXGW2

![544](assets/544.jpg)

# 545. Escher's prentententoonstelling

Mdf3zM

![545](assets/545.jpg)

# 546. Bridge

Mds3z2

![546](assets/546.jpg)

# 547. Wythoffian Tiling Generator

wlGSWc

![547](assets/547.jpg)

# 548. Wythoff Uniform Tilings +Duals

3tyXWw

![548](assets/548.jpg)

# 549. Tilings

4sf3zX

![549](assets/549.png)

# 550. simple hexagonal tiles

MlXyDl

![550](assets/550.jpg)

# 551. River Flight

4sSXDG

![551](assets/551.jpg)

# 552. Hemispherical SDF AO

4sdGWN

![552](assets/552.jpg)

# 553. Alien cocoons

MsdGz2

![553](assets/553.jpg)

# 554. Type 2 Supernova

lsyXDK

![554](assets/554.jpg)

# 555. Type 2 Supernova VR

XdKSDV

![555](assets/555.jpg)

# 556. IcePrimitives

MscXzn

![556](assets/556.jpg)

# 557. [SH17A] Transparent Isoslices

MsjBDR

![557](assets/557.jpg)

# 558. Weather

4dsXWn

![558](assets/558.jpg)

# 559. Rasterizer - Object

4slGzn

![559](assets/559.jpg)

# 560. The Inversion Machine

4dsGD7

![560](assets/560.jpg)

# 561. Robin

4tl3RM

![561](assets/561.jpg)

# 562. Raymarching in Raymarching

wlSGWy

![562](assets/562.jpg)

# 563. Ball Of Fire

lsf3RH

![563](assets/563.jpg)

# 564. [SH2014] Cellular

Xs2GDd

![564](assets/564.jpg)

# 565. MetaHexaBalls

Mss3WN

![565](assets/565.jpg)

# 566. electron

MslGRn

![566](assets/566.jpg)

# 567. Sphere Gears

tt2XzG

![567](assets/567.jpg)

# 568. Worms

XsjXR1

![568](assets/568.jpg)

# 569. contraption

XlVcWz

![569](assets/569.jpg)

# 570. Trapezoid - distance

MlycD3

![570](assets/570.jpg)

# 571. Chaturanga

wsBfzW

![571](assets/571.jpg)

# 572. Optimized Ashima SimplexNoise3D

Xd3GRf

![572](assets/572.jpg)

# 573. Tileable Cells

4djGRh

![573](assets/573.jpg)

# 574. Optimized Ashima SimplexNoise2D

4sdGD8

![574](assets/574.jpg)

# 575. Minecraft

4ds3WS

![575](assets/575.jpg)

# 576. polyanka

MdsGzS

![576](assets/576.jpg)

# 577. shortest maze 5 (65 chars)

lt2cRR

![577](assets/577.png)

# 578. Shimmy

fd2GD1

![578](assets/578.jpg)

# 579. Puzzle ball pattern.

fs2Xzz

![579](assets/579.jpg)

# 580. fairy_circle.ff3

7dfXR2

![580](assets/580.jpg)

# 581. Tentacle Object

3tXXRn

![581](assets/581.jpg)

# 582. Corridor Travel

3sXyRN

![582](assets/582.jpg)

# 583. Galaxy of Universes

MdXSzS

![583](assets/583.jpg)

# 584. Galaxy of Universes (2)

XdsSRS

![584](assets/584.jpg)

# 585. Protophore

XljGDz

![585](assets/585.jpg)

# 586. Sparks drifting

MlKSWm

![586](assets/586.jpg)

# 587. Truchet Tentacles

ldfGWn

![587](assets/587.jpg)

# 588. Combustible Voronoi

4tlSzl

![588](assets/588.jpg)

# 589. Julia - Quaternion 1

MsfGRr

![589](assets/589.jpg)

# 590. Abstract Plane

4sGSRV

![590](assets/590.jpg)

# 591. [NV15] Impact

ltj3zR

![591](assets/591.jpg)

# 592. Waves

4dsGzH

![592](assets/592.jpg)

# 593. Smiley Tutorial

lsXcWn

![593](assets/593.jpg)

# 594. Neptune Racing

XtX3Rr

![594](assets/594.jpg)

# 595. Oblivion radar

4s2SRt

![595](assets/595.jpg)

# 596. Triangle Grid Contouring

WtfGDX

![596](assets/596.jpg)

# 597. Orbital Flights

4lVGRy

![597](assets/597.jpg)

# 598. Inverse Spherical Fibonacci

lllXz4

![598](assets/598.jpg)

# 599. Cellular Tiled Tunnel

MscSDB

![599](assets/599.jpg)

# 600. Cellular Tiling

4scXz2

![600](assets/600.jpg)

# 601. Who?

MdfXWX

![601](assets/601.png)

# 602. Voronoi - rocks

MsXGzM

![602](assets/602.jpg)

# 603. Julia - Quaternion 2

lsl3W2

![603](assets/603.jpg)

# 604. when voxels wed pixels

MsKfRw

![604](assets/604.jpg)

# 605. Julia - Distance 2

3llyzl

![605](assets/605.jpg)

# 606. Julia - Distance 1

Mss3R8

![606](assets/606.jpg)

# 607. Julia - Distance 3

4dXGDX

![607](assets/607.jpg)

# 608. Geomechanical

MdcXzn

![608](assets/608.jpg)

# 609. Transparent Cube Field

ll2SRy

![609](assets/609.jpg)

# 610. Tribute to Marc-Antoine Mathieu

XlfBR7

![610](assets/610.jpg)

# 611. textured ellipsoids

XsfXW8

![611](assets/611.jpg)

# 612. Kirby Jump

lt2fD3

![612](assets/612.jpg)

# 613. Rounded Voronoi Borders

ll3GRM

![613](assets/613.jpg)

# 614. [SH16B] WIP: Warp Tunnel

XtdGR7

![614](assets/614.jpg)

# 615. in my crawl space

ttlXRf

![615](assets/615.jpg)

# 616. Wait.. what? CyberTruck!

wdGXzK

![616](assets/616.jpg)

# 617. [SH17A] Tiny Clouds

lsBfDz

![617](assets/617.jpg)

# 618. Relentless

lss3WS

![618](assets/618.jpg)

# 619. Reprojection

XdlGzH

![619](assets/619.jpg)

# 620. Outrun The Rain

ltccRl

![620](assets/620.jpg)

# 621. Raymarched Reflections

4dt3zn

![621](assets/621.jpg)

# 622. mpeg artifacts

Md2GDw

![622](assets/622.jpg)

# 623. Rolling hills

Xsf3zX

![623](assets/623.jpg)

# 624. Ray Marching: Part 1

llt3R4

![624](assets/624.png)

# 625. Torus_Thingy_8

lt2fDz

![625](assets/625.jpg)

# 626. DoF, CA, OL, Camera demo, Enjoy!

7tB3Dz

![626](assets/626.jpg)

# 627. 2d tentacles

slS3WR

![627](assets/627.jpg)

# 628. Toon Cloud

4t23RR

![628](assets/628.jpg)

# 629. toon video shader

XdB3zV

![629](assets/629.jpg)

# 630. Snaliens

tlV3zy

![630](assets/630.jpg)

# 631. Oskar Stålberg every-other-pixel

3slcWN

![631](assets/631.jpg)

# 632. Simple Cartoon via YUV2RGB

MslfWj

![632](assets/632.jpg)

# 633. toon-ish shader

4djBDt

![633](assets/633.jpg)

# 634. Kuwahara Filtering

MsXSz4

![634](assets/634.jpg)

# 635. Colorful smoke noise

wlSyDd

![635](assets/635.jpg)

# 636. cartoon motionblur

3sB3zd

![636](assets/636.jpg)

# 637. Toon Shader

WttBD8

![637](assets/637.jpg)

# 638. Bunch o' random shapes

NtSGDR

![638](assets/638.jpg)

# 639. oushinnyo's first shader

ft2GDz

![639](assets/639.jpg)

# 640. Class 5 Homework BRDF (gerrit)

Ntj3Wz

![640](assets/640.jpg)

# 641. smol hash

fljGWz

![641](assets/641.jpg)

# 642. Value Noise in 147 chars

Nt2GDR

![642](assets/642.jpg)

# 643. Mountain rivers

flj3WR

![643](assets/643.jpg)

# 644. Day 43

wt3XR4

![644](assets/644.jpg)

# 645. Day 74

3tGSR3

![645](assets/645.jpg)

# 646. Not Day 79

tlySDV

![646](assets/646.jpg)

# 647. Day 84

Wssczn

![647](assets/647.jpg)

# 648. Day 30 - Xargantian Polyjupe

tlG3RV

![648](assets/648.jpg)

# 649. Day 59

3ldSWf

![649](assets/649.jpg)

# 650. Day 99

tdfyRl

![650](assets/650.jpg)

# 651. Tunnel 3D Shape

4djfWt

![651](assets/651.jpg)

# 652. Rhodium Fractalscape

ltKGzc

![652](assets/652.jpg)

# 653. Molten rock

MdBXDV

![653](assets/653.jpg)

# 654. Tunnel Beauty

Mt3GW2

![654](assets/654.jpg)

# 655. Fantasy scene

ldXSzr

![655](assets/655.jpg)

# 656. Pegasus Galaxy

lty3Rt

![656](assets/656.jpg)

# 657. Ethereal

ltB3DG

![657](assets/657.jpg)

# 658. Columns and Lights

lsf3zr

![658](assets/658.jpg)

# 659. Awesome star

4lfSzS

![659](assets/659.jpg)

# 660. Fractal Tiling

Ml2GWy

![660](assets/660.jpg)

# 661. Apollian with a twist

Wl3fzM

![661](assets/661.jpg)

# 662. Sculpture III

XtjSDK

![662](assets/662.jpg)

# 663. Descent 3D

wdfGW4

![663](assets/663.jpg)

# 664. Dual 3D Truchet Tiles

4l2cD3

![664](assets/664.jpg)

# 665. More spheres

lsX3DH

![665](assets/665.jpg)

# 666. Bubble rings

WdB3Dw

![666](assets/666.jpg)

# 667. Abandoned base

XsSSRW

![667](assets/667.jpg)

# 668. Ring Twister

Xt23z3

![668](assets/668.jpg)

# 669. marble

XsSGDh

![669](assets/669.jpg)

# 670. glyphspinner

XsVcDy

![670](assets/670.jpg)

# 671. Rounded Voxels

4djGWR

![671](assets/671.jpg)

# 672. Desert Passage

XtyGzc

![672](assets/672.jpg)

# 673. Miracle Snowflakes

Xsd3zf

![673](assets/673.jpg)

# 674. [4k] Sync Cord - Revision 2020

Ws2cDD

![674](assets/674.jpg)

# 675. E1M1 - Hangar

lsSXzD

![675](assets/675.jpg)

# 676. quadtree 3

lljSDy

![676](assets/676.jpg)

# 677. Hexagone

wsl3WB

![677](assets/677.jpg)

# 678. Bacterium

MdBSDt

![678](assets/678.jpg)

# 679. Cloudy Shapes

WdXGRj

![679](assets/679.jpg)

# 680. Angels

lssGRM

![680](assets/680.jpg)

# 681. Topologica

4djXzz

![681](assets/681.jpg)

# 682. sphere intersect pub

XsfBRH

![682](assets/682.jpg)

# 683. Winding Menger Tunnel

4scXzn

![683](assets/683.jpg)

# 684. Ray Marching Experiment n°35

4t2SWW

![684](assets/684.jpg)

# 685. The Cave

MsX3RH

![685](assets/685.jpg)

# 686. Crossy Penguin [MIGJRV]

4dKXDG

![686](assets/686.jpg)

# 687. Distorted TV

ldXGW4

![687](assets/687.jpg)

# 688. Full Scene Radial Blur

XsKGRW

![688](assets/688.jpg)

# 689. Filtering procedurals

MdjGR1

![689](assets/689.jpg)

# 690. Stockholms Ström

4dd3Rl

![690](assets/690.jpg)

# 691. Cable nest

ftXXWX

![691](assets/691.jpg)

# 692. Mist by Ohno! - part2

wdBGWD

![692](assets/692.jpg)

# 693. Blueprint of the Architekt

4tySDW

![693](assets/693.jpg)

# 694. [SIG15] Oblivion

XtfXDN

![694](assets/694.jpg)

# 695. [SH18] Woman

4tdcWS

![695](assets/695.jpg)

# 696. Shiny Circle

ltBXRc

![696](assets/696.jpg)

# 697. Echeveria II

WtGXWm

![697](assets/697.jpg)

# 698. Isometric City 2.5D

MljXzz

![698](assets/698.jpg)

# 699. Steel Lattice

4tlSWl

![699](assets/699.jpg)

# 700. Kelp Forest

llcSz8

![700](assets/700.jpg)

# 701. Shiny sphere lights

ltjGDd

![701](assets/701.jpg)

# 702. Terminator

MdSXzG

![702](assets/702.jpg)

# 703. Tiny Planet Clouds

ldyXRw

![703](assets/703.jpg)

# 704. Sky001

XsVGz3

![704](assets/704.jpg)

# 705. rosace 3c

Ms3SzB

![705](assets/705.png)

# 706. Puffy

ltdyDl

![706](assets/706.jpg)

# 707. [SH18] BabyToy

lldyWn

![707](assets/707.jpg)

# 708. Rainbow Laser Beam

XtBXW3

![708](assets/708.jpg)

# 709. The road to Hell

Mds3Rn

![709](assets/709.jpg)

# 710. Insect

Mss3zM

![710](assets/710.jpg)

# 711. The Popular Shader

XdB3Dw

![711](assets/711.jpg)

# 712. Fractal Flythrough

4s3SRN

![712](assets/712.jpg)

# 713. Waves Remix

4ljGD1

![713](assets/713.jpg)

# 714. Useless Box

XdBSD3

![714](assets/714.jpg)

# 715. The Disco Tunnel

lsBSRR

![715](assets/715.jpg)

# 716. Sneak Preview

XsK3R3

![716](assets/716.jpg)

# 717. Waterworld

lsBSWm

![717](assets/717.jpg)

# 718. enlightened dark cloud

4slGWM

![718](assets/718.jpg)

# 719. Planet Fall

lltBWB

![719](assets/719.jpg)

# 720. Entangled Vines

MlBSDW

![720](assets/720.jpg)

# 721. Sailing Beyond - Hyper Tunnel

4t2cR1

![721](assets/721.jpg)

# 722. Time Coordinates

Xd2XWR

![722](assets/722.jpg)

# 723. Tissue

XdBSzd

![723](assets/723.jpg)

# 724. prism liquid

WtSBzh

![724](assets/724.jpg)

# 725. Metaballs - Quintic

ld2GRz

![725](assets/725.jpg)

# 726. Motion Blur Visualization

XdXXz4

![726](assets/726.jpg)


# 727. [SH16B]Escape

4lcGWr

![727](assets/727.jpg)

# 728. Twisted Columns

Xl2GRc

![728](assets/728.jpg)

# 729. Danger Noodle

wlVSDK

![729](assets/729.jpg)

# 730. Three Pass DOF Example

MsG3Dz

![730](assets/730.jpg)

# 731. Volume raycasting

lss3zr

![731](assets/731.jpg)

# 732. Warp speed

Msl3WH

![732](assets/732.jpg)

# 733. Physically-based SDF

XlKSDR

![733](assets/733.jpg)

# 734. Mobius Object

XldSDs

![734](assets/734.jpg)

# 735. Infinite City

4df3DS

![735](assets/735.jpg)

# 736. Quasi Infinite Zoom Voronoi

XlBXWw

![736](assets/736.jpg)

# 737. La calanque

Mst3Wr

![737](assets/737.jpg)

# 738. Taste of Noise 7

NddSWs

![738](assets/738.jpg)

# 739. Gas Giant!

llj3zV

![739](assets/739.jpg)

# 740. [SIG15] sigmoids n sines

ltfXzj

![740](assets/740.jpg)

# 741. A lot of spheres

lsX3WH

![741](assets/741.jpg)

# 742. Sunsets

lss3DS

![742](assets/742.jpg)

# 743. Atmosphere system test

XtBXDz

![743](assets/743.jpg)

# 744. Sparkling Cookie

3ljXWK

![744](assets/744.jpg)

# 745. Spiraled Layers

Ns3XWf

![745](assets/745.jpg)

# 746. Alexander horned sphere zoom

ttyGzW

![746](assets/746.jpg)

# 747. Day 94

tdXcWM

![747](assets/747.jpg)

# 748. Day 33 - Metalicity

WlK3Rd

![748](assets/748.jpg)

# 749. Day 357

wsGBWd

![749](assets/749.jpg)

# 750. [music] Ghidra

Wty3WD

![750](assets/750.jpg)

# 751. Day 47 - Isometric 2

WtcXD8

![751](assets/751.jpg)

# 752. [music][twitch] Day 5 of MDTMJVM

wtd3zX

![752](assets/752.jpg)

# 753. Day 670

fdKSDW

![753](assets/753.jpg)

# 754. Day 669

sdySWh

![754](assets/754.jpg)

# 755. Day 558

7tBGDd

![755](assets/755.jpg)

# 756. Livecode demozoo jam

7t23DK

![756](assets/756.jpg)

# 757. Day 538

ftS3z1

![757](assets/757.jpg)

# 758. Day 532

NtsGWS

![758](assets/758.jpg)

# 759. Day 531

stsGRl

![759](assets/759.jpg)

# 760. Day 514

Ns2XD3

![760](assets/760.jpg)

# 761. Day 490

NdlXzs



# 762. Cookie casual Shader Showdown

NsfXRf



# 763. Not a 16-cell honeycomb

7ssSD4



# 764. Day 486[4d kaliset]

ssfSWN



# 765. Day 486[4d projected fractal]

7dXXD4



# 766. Day 485[4d projected apollonian]

fdXSD4



# 767. Day 482

NslSRM



# 768. Day 478

7sBGDc



# 769. Day 475

fsB3zt



# 770. day 428

ttGBRR

# 771. Day 423

Wl3Bzl

# 772. Viscosity Clone #1

7ldXDs

# 773. Viscosity

tdyBRt

# 774. BadLand

ltB3zt

# 775. Exit the Matrix

NlsXDH

# 776. a basic checkerboard

ssjcRD

# 777. Rainbow layers

Nd2cRd

# 778. basic shapes v1

fsjczw

# 779. odos| voronoi boxes

NsScDV

# 780. CATS with basic shapes

7d2yRD

# 781. odos | spiral

sd2cRd

# 782. odos|psrdnoise warping

sdSyWK

# 783. odos|toon fire

NdjyWV

# 784. Sun surface

XlSSzK

# 785. Binary star

ltjSWV

# 786. Above the clouds

ll2SWd

# 787. Volumetric cloud

4ldGRf

# 788. Tornado 1

4tSSDK

# 789. Pyroclastic sun

XtlXR2

# 790. Clouds mod experiment

lljXWG

# 791. Dusty nebula 2

ltBXWy

# 792. Binary system

Msd3DH











https://www.shadertoy.com/results?query=&sort=love&from=372&num=12

https://www.shadertoy.com/user/jeyko/sort=newest&from=32&num=8