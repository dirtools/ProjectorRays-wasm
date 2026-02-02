VERSION_NUMBER=0.2.1
GIT_SHA=$(shell git rev-parse --short HEAD)

CPPFLAGS+=-DVERSION_NUMBER=$(VERSION_NUMBER) -DGIT_SHA=$(GIT_SHA)
CXXFLAGS+=-std=c++17 -Wall -Wextra -Isrc
LDLIBS+=-lz -lmpg123
LDFLAGS_RELEASE+=-s -Os

BINARY=projectorrays
WASM_OUTPUT=projectorrays.js
WASM_MPG123 ?= 0
MPG123_DIR ?= third_party/mpg123
MPG123_WASM_BUILD_DIR ?= $(MPG123_DIR)/build-wasm
MPG123_WASM_INCLUDE ?= $(MPG123_DIR)/src/include
MPG123_WASM_LIB ?= $(MPG123_WASM_BUILD_DIR)/src/libmpg123/.libs/libmpg123.a
WASM_MPG123_CFLAGS = $(if $(filter 1,$(WASM_MPG123)),-I$(MPG123_WASM_INCLUDE),)
WASM_MPG123_LIBS = $(if $(filter 1,$(WASM_MPG123)),$(MPG123_WASM_LIB),)

ifeq ($(OS),Windows_NT)
# shlwapi is required by mpg123
	LDLIBS+=-lshlwapi
	LDFLAGS+=-static -static-libgcc
	BINARY=projectorrays.exe
endif

FONTMAPS = $(wildcard fontmaps/*.txt)
FONTMAP_HEADERS = $(patsubst %.txt,%.h,$(FONTMAPS))

.PHONY: all
all: $(BINARY)

fontmaps/%.h: $(patsubst %.h,%.txt,$@)
	xxd -i $(patsubst %.h,%.txt,$@) > $@

OBJS = \
	src/main.o \
	src/common/codewriter.o \
	src/common/json.o \
	src/common/log.o \
	src/common/stream.o \
	src/common/util.o \
	src/director/castmember.o \
	src/director/chunk.o \
	src/director/dirfile.o \
	src/director/fontmap.o \
	src/director/guid.o \
	src/director/sound.o \
	src/director/subchunk.o \
	src/director/util.o \
	src/io/fileio.o \
	src/io/options.o \
	src/lingodec/ast.o \
	src/lingodec/context.o \
	src/lingodec/handler.o \
	src/lingodec/names.o \
	src/lingodec/script.o

WASM_SOURCES = \
	src/wasm.cpp \
	src/common/codewriter.cpp \
	src/common/json.cpp \
	src/common/log.cpp \
	src/common/stream.cpp \
	src/common/util.cpp \
	src/director/castmember.cpp \
	src/director/chunk.cpp \
	src/director/dirfile.cpp \
	src/director/fontmap.cpp \
	src/director/guid.cpp \
	src/director/sound.cpp \
	src/director/subchunk.cpp \
	src/director/util.cpp \
	src/io/fileio.cpp \
	src/io/options.cpp \
	src/lingodec/ast.cpp \
	src/lingodec/context.cpp \
	src/lingodec/handler.cpp \
	src/lingodec/names.cpp \
	src/lingodec/script.cpp

src/director/fontmap.o: $(FONTMAP_HEADERS)

$(BINARY): $(OBJS)
	$(CXX) -o $(BINARY) $(CPPFLAGS) $(CXXFLAGS) $(OBJS) $(LDFLAGS) $(LDFLAGS_RELEASE) $(LDLIBS)

debug: CXXFLAGS+=-g -fsanitize=address
debug: LDFLAGS_RELEASE=
debug: $(BINARY)

release: CPPFLAGS+=-DRELEASE_BUILD
release: $(BINARY)

.PHONY: clean
clean:
	-rm $(BINARY) $(FONTMAP_HEADERS) $(OBJS) $(WASM_OUTPUT) projectorrays.wasm

.PHONY: wasm
wasm: $(FONTMAP_HEADERS)
	@if [ "$(WASM_MPG123)" = "1" ] && [ ! -f "$(MPG123_WASM_LIB)" ]; then \
		echo "Missing $(MPG123_WASM_LIB). Run 'make wasm-mpg123' first."; \
		exit 1; \
	fi
	emcc $(CPPFLAGS) -std=c++17 -Isrc -Isrc/emscripten $(WASM_MPG123_CFLAGS) -O2 -fexceptions $(if $(filter 0,$(WASM_MPG123)),-DPROJECTORRAYS_DISABLE_MPG123,) \
		$(WASM_SOURCES) -o $(WASM_OUTPUT) $(WASM_MPG123_LIBS) \
		-s USE_ZLIB=1 -s ALLOW_MEMORY_GROWTH=1 -s DISABLE_EXCEPTION_CATCHING=0 \
		-s EXPORTED_FUNCTIONS='["_projectorrays_decompile","_projectorrays_free","_malloc","_free"]' \
		-s EXPORTED_RUNTIME_METHODS='["cwrap","ccall"]'

.PHONY: wasm-mpg123
wasm-mpg123:
	mkdir -p $(MPG123_WASM_BUILD_DIR)
	cd $(MPG123_WASM_BUILD_DIR) && emconfigure ../configure --disable-shared --enable-static --disable-assembly --with-cpu=generic
	EMCC_CFLAGS="-O2" emmake make -C $(MPG123_WASM_BUILD_DIR)
