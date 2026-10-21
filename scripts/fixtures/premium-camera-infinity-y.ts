/** Exact Y/W2 oracle and public viewport rectangles captured before/after Z.
 * Z changes only camera-subject arclength; no scene/model crop is authorized. */
export const INFINITY_Y = {
  "cameraSha": "917e2641370199960b5d0e49c8f3d80b5223dfcfce6440a449f6084245deec99",
  "sceneSha": "3ce3be1f8ea316605061f4dc8e4da0f1d19e883ca2afc429bcb56d00bbe81abf",
  "oldSpan": "const span = Math.min(total, Math.max(2.8, Math.min(4, (dims.dropHeight + dims.catchBasinDepth + innerDepth) * 1.7)));",
  "newSpan": "const span = Math.min(total, dims.dropHeight + dims.catchBasinDepth + innerDepth);",
  "functions": {
    "overviewDirection": "71f716702b2db2a8d06abf7f3f76302d15cffc54bc8ef76467d494e0288f8999",
    "fitComponentCamera": "da6bee1971f6afe1e7e469f9f13043afb1a06a3d2d68aa77a92b4114a8bef6f1",
    "componentCameraAspect": "7a72720338355351d757998a83ab8f8817c445a178bba5dda9bf59228ff07bb2",
    "overviewCameraSubject": "61795f89e6277dce6ce89b0a48693d77949e9535ef392de21dba86fbeb3dc689",
    "sunShelfCameraSubject": "1ad5040fd0ed434f7cf530c1e003cd51f3491b5d206acef4b5e2eb0f23ccc702",
    "accessCameraSubject": "aa1287c7ae32eac0a0bba7b880f1d3b497fe7fce455343b0a0092df35c53281b",
    "accessFlightCameraSubject": "784f5a795da857b23af234e9c26d034553d1deef168d4a190de461222cd772c7",
    "comfortCameraSubject": "fdca658bf3be0db69ec63cb6456f7d3fb9c78f3c3dfbd2195eda9610364e4d2b",
    "microLightCameraSubject": "1d38e1bd09975b7a4c15845e5f3d8c5bdae2618a068ce5a6fc7e3028cdbe4c27",
    "openBenchLightingView": "0a2b7218186dd27395685d89aeab8cac5889c3bd4a789d2d78eebaae6f082643",
    "openBenchLightingFov": "aad4cb4965afe65f5d73373a2ec3b74df6328eac42fbac026eb84a4cc2219a1f",
    "fitBenchLightingCamera": "f4be10237b4b1c58018eeeb3988e48cca7970319b4a905e652e918d426a0f5af",
    "lightingCameraSubject": "41aa7b811c2220cd142e00c840e543e7b8987e63a84185c64dbb6d9884119086",
    "externalStairCameraSubject": "9b2697690f5b62c28a82040fedc48f0c190d36e78bd1d4d92ab639637cff45e2",
    "pavingCameraSubject": "a1f5d13a2ba7d35a0ce8f5c9264eb8ff68da3f2e8453d26d776dc22d94f4da2c",
    "coverCameraSubject": "b28b7176452c50630f82f48da76608b467a7db0e1cfdc8085c25f7425ca1fcbf",
    "infinityDetailCameraSubject": "79f4b1fd80a9658c22c8e31cdace45522928f099ef277bacae6a6b5bda221125",
    "infinityCopingCameraSubject": "5d2de8647e0e2804183ee91e9b2f2a2d98e2bf8c66905c556efc143c29158d42",
    "overflowCameraSubject": "87795b2d2178efc95b7895e5ecf902e684568153540e8218e5fe8e4e0d5914ec",
    "dimensionFrustum": "5bef3a2e5ed944cc38b1b97a2d18c58ed4f1971afb33f504cfedb45340541465",
    "contextualAccessCamera": "e0d54315fadfb3f80345fe5b6c12bc07aaf2b44bb15e6688e5ff0b781ab089ff",
    "visibleCameraFrame": "8786a5786e2ab9954bd76b4937cf2dbb1995c0dbf556177bf73603b50860dd85",
    "cameraFrameFit": "227a798b131d27f5b9fdea1a26e69e5e43dda5044d85dc1842d15e08d679dd37",
    "offsetCameraToFrame": "8844a170382d58f59bc1e6fb80b6da2c01307997aab2348889487e849ace21bf",
    "infinityNavigationLimits": "a3bdf8f09296681a340e4d14ee7d534b2f638ddcf5d262ef26e211b4269c14d7",
    "outlineCentre": "1608867461b368881d2528301457991cca15591eb0dff58905b001651f477d00",
    "detailPose": "a3aae12dd13b722e35036fbc6ee94f7e297c1ff5268d39881738823b82ee5142",
    "getFrontWallReference": "0164fd4816a0aa32b778f23d22b1c94adaf4291c432e030cd81dcab0a6b164a7",
    "waterlineCameraSubject": "c49adf8c77cbe5ccf95dc232f38065eccb0cec5b4ce8057193bc023d8d94025d",
    "infinityWaterlineCameraSubject": "b8f4792eeb83d7bf524bf5c696376bb17c55a72913a8356bcef86b695aee88f9",
    "getFrontWallMasterCamera": "30806a418374f6a8c66f0c12c1325b6ba7113224cfad6db4533f787061effb60",
    "getSystemDetailCamera": "21577f36ddf19b2e7114410710850c8b269aabc23aba6164e685cfb8872d5492",
    "getInfinityDetailCamera": "78549876df6e01af2d4e03c92e50e2934050f54b6b83effd2971b6e31f65aac0",
    "interiorFinishCameraSubject": "6edb5294034786a2bac8dcd5f296ae27574eef05d9efbbe87cdc9f102cdb6a73",
    "getInteriorFinishCamera": "5c7c90eed1361ed524f65158bda5a990d2bf897aff715e5b4be79613515181d9",
    "getAccessDetailCamera": "dddde191d98b67e7a61111944a7b6817fa6c84939ef77553d72ed9728f8cabc9",
    "getFeaturesCamera": "cb88b0c871b569cfb5666fdf68741740290aaeb6d45944358ada433ec90f8f11",
    "getCameraPose": "5d714cfdd61991b244f0f510e0d0d950e7d1d27dfe0824ffdb1dfe406e310eea"
  },
  "ui": {
    "390": {
      "source": "W2-final-infinity-traditional-side3-6x3-390-dom.json",
      "canvas": {
        "bottom": 844,
        "height": 844,
        "left": 0,
        "right": 390,
        "top": 0,
        "width": 390,
        "x": 0,
        "y": 0
      },
      "overlays": [
        {
          "bottom": 116,
          "height": 108,
          "left": 8,
          "right": 382,
          "top": 8,
          "width": 374,
          "x": 8,
          "y": 8
        },
        {
          "bottom": 168,
          "height": 36,
          "left": 12,
          "right": 143.9140625,
          "top": 132,
          "width": 131.9140625,
          "x": 12,
          "y": 132
        },
        {
          "bottom": 333.515625,
          "height": 40,
          "left": 180.921875,
          "right": 374,
          "top": 293.515625,
          "width": 193.078125,
          "x": 180.921875,
          "y": 293.515625
        },
        {
          "bottom": 329.515625,
          "height": 32,
          "left": 289,
          "right": 321,
          "top": 297.515625,
          "width": 32,
          "x": 289,
          "y": 297.515625
        },
        {
          "bottom": 333.515625,
          "height": 40,
          "left": 334,
          "right": 374,
          "top": 293.515625,
          "width": 40,
          "x": 334,
          "y": 293.515625
        },
        {
          "bottom": 0,
          "height": 0,
          "left": 0,
          "right": 0,
          "top": 0,
          "width": 0,
          "x": 0,
          "y": 0
        },
        {
          "bottom": 836,
          "height": 470.484375,
          "left": 8,
          "right": 382,
          "top": 365.515625,
          "width": 374,
          "x": 8,
          "y": 365.515625
        }
      ]
    },
    "430": {
      "source": "Z-infinity-430-dom.json",
      "canvas": {
        "bottom": 932,
        "height": 932,
        "left": 0,
        "right": 430,
        "top": 0,
        "width": 430,
        "x": 0,
        "y": 0
      },
      "overlays": [
        {
          "bottom": 116,
          "height": 108,
          "left": 8,
          "right": 422,
          "top": 8,
          "width": 414,
          "x": 8,
          "y": 8
        },
        {
          "bottom": 168,
          "height": 36,
          "left": 12,
          "right": 143.9140625,
          "top": 132,
          "width": 131.9140625,
          "x": 12,
          "y": 132
        },
        {
          "bottom": 386.3125,
          "height": 40,
          "left": 220.921875,
          "right": 414,
          "top": 346.3125,
          "width": 193.078125,
          "x": 220.921875,
          "y": 346.3125
        },
        {
          "bottom": 382.3125,
          "height": 32,
          "left": 329,
          "right": 361,
          "top": 350.3125,
          "width": 32,
          "x": 329,
          "y": 350.3125
        },
        {
          "bottom": 386.3125,
          "height": 40,
          "left": 374,
          "right": 414,
          "top": 346.3125,
          "width": 40,
          "x": 374,
          "y": 346.3125
        },
        {
          "bottom": 0,
          "height": 0,
          "left": 0,
          "right": 0,
          "top": 0,
          "width": 0,
          "x": 0,
          "y": 0
        },
        {
          "bottom": 924,
          "height": 505.6875,
          "left": 8,
          "right": 422,
          "top": 418.3125,
          "width": 414,
          "x": 8,
          "y": 418.3125
        }
      ]
    },
    "1440": {
      "source": "Z-infinity-1440-dom.json",
      "canvas": {
        "bottom": 900,
        "height": 900,
        "left": 0,
        "right": 1440,
        "top": 0,
        "width": 1440,
        "x": 0,
        "y": 0
      },
      "overlays": [
        {
          "bottom": 84,
          "height": 72,
          "left": 16,
          "right": 1424,
          "top": 12,
          "width": 1408,
          "x": 16,
          "y": 12
        },
        {
          "bottom": 132,
          "height": 36,
          "left": 16,
          "right": 147.9140625,
          "top": 96,
          "width": 131.9140625,
          "x": 16,
          "y": 96
        },
        {
          "bottom": 0,
          "height": 0,
          "left": 0,
          "right": 0,
          "top": 0,
          "width": 0,
          "x": 0,
          "y": 0
        },
        {
          "bottom": 0,
          "height": 0,
          "left": 0,
          "right": 0,
          "top": 0,
          "width": 0,
          "x": 0,
          "y": 0
        },
        {
          "bottom": 0,
          "height": 0,
          "left": 0,
          "right": 0,
          "top": 0,
          "width": 0,
          "x": 0,
          "y": 0
        },
        {
          "bottom": 487.5078125,
          "height": 40,
          "left": 1114.8515625,
          "right": 1420,
          "top": 447.5078125,
          "width": 305.1484375,
          "x": 1114.8515625,
          "y": 447.5078125
        },
        {
          "bottom": 884,
          "height": 368.4921875,
          "left": 130,
          "right": 1310,
          "top": 515.5078125,
          "width": 1180,
          "x": 130,
          "y": 515.5078125
        }
      ]
    }
  }
} as const;
