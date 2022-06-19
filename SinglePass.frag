#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_texture_0; //input image
uniform sampler2D u_texture_1; //noise

uniform vec2 u_resolution;
uniform float u_time;

float hash11(float p)
{
    return fract(53.156*sin(p*45.45))-.5;
}
float hash21(vec2 p){
    return fract(sin(p.x *100.+p.y*6574.)*5678.);
}
vec3 hash23( vec2 p ) {
	p		= fract( p * vec2( 5.3983, 5.4427 ) );
    p		+= dot( p.yx, p.xy + vec2( 21.5351, 14.3137 ) );
	return fract( p.x * p.y * vec3( 95.4337, 97.597, 93.234 ) );
}
vec3 Screen(vec3 base, vec3 blend)
{
	return base + blend - base*blend;
}
//http://gamedev.stackexchange.com/questions/59797/glsl-shader-change-hue-saturation-brightness
vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
void main()
{
    vec2 inputResolution = vec2(1080.,1920.);
    vec2 screenResolution = u_resolution;
    vec2 ratio = screenResolution/inputResolution;
    vec2 uv = gl_FragCoord.xy;
    uv-= 0.5*inputResolution*max(vec2(ratio.x-ratio.y,ratio.y-ratio.x),0.);
    uv /= inputResolution*min(ratio.x,ratio.y );
    float mask = fract(uv)==uv?1.:0.;

    vec3 col;

    //Заготовка под трекинг. Горизонтальные полосы и уникальные значения в каждой из них
    float scanlinesCount=100.;
    float shake = (hash11(u_time)-0.5)*0.1;
    float scanLines = (uv.y+shake)*scanlinesCount;
    float scanLinesID = ceil(scanLines)/scanlinesCount;
    scanLines = fract(scanLines);
    scanLines = abs(scanLines-0.5)*2.;

    //Маска из текстуры шума. Различия в скорости скролла создают ощущение направленного движения вниз. 
    float scanLinesMask=texture2D(u_texture_1,vec2(fract(u_time*0.1),scanLinesID+fract(u_time*0.5))).r;
    //Маска для обрезки трекинга сверху.
    float verticalMask=uv.y;
    verticalMask= clamp(verticalMask,0.0,0.3);
    scanLinesMask-=verticalMask;
    //Граничные значения
    scanLinesMask=smoothstep(0.3,0.5,scanLinesMask);
    //Придание формы горизантальным полосам
    scanLines*=scanLinesMask;
    scanLines=pow(scanLines,0.2);

    vec2 noiseUV = uv;
    noiseUV.x*=0.5;
    noiseUV.x+=+hash11(scanLinesID+u_time);
    float noise = texture2D(u_texture_1,noiseUV).r;
    float tracking = noise*scanLines;
    tracking = smoothstep(0.5,0.6 ,tracking );

    float chromaScanLinesAmp = 0.05;
    float chromaAmp = 0.01;

    chromaScanLinesAmp*=smoothstep(0.4,0.8,scanLinesMask);

    vec2 one = vec2(1.0,0.0);

    //шум для более плавной абберации от трекинга
    float dither = hash21(fract(uv+u_time))*0.333;
    float ditherR = dither+0.666;     
    float ditherG = dither+0.333;        
    
    //Синусный дисторт UV (step 2)
    float sineDistortion = sin(uv.y*2000.)*0.005;

    //Сэмпл изображения.
    //                                  Абберация от трекинга                Статичная       Синусный дисторт
    float r = texture2D(u_texture_0,uv  -one*chromaScanLinesAmp*ditherR      -one*chromaAmp  +one*sineDistortion).r;
    float g = texture2D(u_texture_0,uv  -one*chromaScanLinesAmp*ditherG                      +one*sineDistortion).g;
    float b = texture2D(u_texture_0,uv  -one*chromaScanLinesAmp*dither       +one*chromaAmp  +one*sineDistortion).b;
    vec3 img = vec3(r,g,b);

    //Noise
    vec3 colorNoise = hash23(uv+fract(u_time*500.));
    img=max(img,colorNoise*0.2);

    //Saturate
    vec3 imgHSV = rgb2hsv(img);
    imgHSV.g*=1.5;
    img = hsv2rgb(imgHSV);

    //col = mix(img,vec3(1.0),vec3(tracking*0.5));

    col=vec3(Screen(img,vec3(tracking*0.5)));
    gl_FragColor = vec4(col, mask);
}