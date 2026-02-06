/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

#include <cstddef>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

#include "common/json.h"
#include "common/stream.h"
#include "director/castmember.h"
#include "director/chunk.h"
#include "director/dirfile.h"

extern "C" {

struct ProjectorRaysHandle {
    std::unique_ptr<Director::DirectorFile> dir;
    std::vector<uint8_t> input;
    std::unique_ptr<Common::ReadStream> stream;
};

static ProjectorRaysHandle *handleFromId(uintptr_t handle) {
    return reinterpret_cast<ProjectorRaysHandle *>(handle);
}

static std::string standardizeJsonEscapes(const std::string &input) {
    std::string out;
    out.reserve(input.size());
    for (size_t i = 0; i < input.size(); ++i) {
        char ch = input[i];
        if (ch != '\\' || i + 1 >= input.size()) {
            out.push_back(ch);
            continue;
        }

        char next = input[i + 1];
        if (next == 'v') {
            out.append("\\u000b");
            ++i;
            continue;
        }
        if (next == 'x' && i + 3 < input.size()) {
            char h1 = input[i + 2];
            char h2 = input[i + 3];
            auto isHex = [](char c) {
                return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
            };
            if (isHex(h1) && isHex(h2)) {
                out.append("\\u00");
                out.push_back(h1);
                out.push_back(h2);
                i += 3;
                continue;
            }
        }

        out.push_back(ch);
    }
    return out;
}

static bool writeDirectorToBuffer(Director::DirectorFile &dir, std::vector<uint8_t> &output) {
    dir.generateInitialMap();
    dir.generateMemoryMap();

    const size_t estimatedSize = dir.size();
    if (estimatedSize == 0) {
        return false;
    }

    size_t actualSize = 0;
    for (int attempt = 0; attempt < 3; ++attempt) {
        const size_t bufferSize = estimatedSize << attempt;
        output.assign(bufferSize, 0);
        try {
            Common::WriteStream stream(output.data(), output.size(), dir.endianness);
            dir.write(stream);
            actualSize = stream.pos();
            break;
        } catch (const std::exception &) {
            actualSize = 0;
        }
    }

    if (actualSize == 0) {
        output.clear();
        return false;
    }

    output.resize(actualSize);
    return true;
}


EMSCRIPTEN_KEEPALIVE uintptr_t projectorrays_read(const uint8_t *input, size_t inputSize) {
    if (!input || inputSize == 0) {
        return 0;
    }

    try {
        auto handle = std::make_unique<ProjectorRaysHandle>();
        handle->input.assign(input, input + inputSize);
        handle->stream =
            std::make_unique<Common::ReadStream>(handle->input.data(), handle->input.size());
        handle->dir = std::make_unique<Director::DirectorFile>();
        if (!handle->dir->read(handle->stream.get())) {
            return 0;
        }
        return reinterpret_cast<uintptr_t>(handle.release());
    } catch (...) {
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE void projectorrays_free_handle(uintptr_t handle) {
    auto *ptr = handleFromId(handle);
    delete ptr;
}

EMSCRIPTEN_KEEPALIVE int projectorrays_chunk_exists(uintptr_t handle, uint32_t fourCC, int32_t id) {
    if (!handle) {
        return 0;
    }

    try {
        auto *ptr = handleFromId(handle);
        if (!ptr || !ptr->dir) {
            return 0;
        }
        return ptr->dir->chunkExists(fourCC, id) ? 1 : 0;
    } catch (...) {
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE int projectorrays_is_cast(uintptr_t handle) {
    if (!handle) {
        return 0;
    }

    try {
        auto *ptr = handleFromId(handle);
        if (!ptr || !ptr->dir) {
            return 0;
        }
        return ptr->dir->isCast() ? 1 : 0;
    } catch (...) {
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE int projectorrays_size(uintptr_t handle) {
    if (!handle) {
        return 0;
    }

    try {
        auto *ptr = handleFromId(handle);
        if (!ptr || !ptr->dir) {
            return 0;
        }
        return static_cast<int>(ptr->dir->size());
    } catch (...) {
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE uint8_t *projectorrays_get_chunk(uintptr_t handle,
                                                     uint32_t fourCC,
                                                     int32_t id,
                                                     size_t *outputSize) {
    if (!handle || !outputSize) {
        return nullptr;
    }

    *outputSize = 0;

    try {
        auto *ptr = handleFromId(handle);
        if (!ptr || !ptr->dir) {
            return nullptr;
        }

        Common::BufferView chunkView = ptr->dir->getChunkData(fourCC, id);
        const size_t size = chunkView.size();
        const size_t allocSize = size > 0 ? size : 1;

        uint8_t *out = static_cast<uint8_t *>(std::malloc(allocSize));
        if (!out) {
            return nullptr;
        }
        if (size > 0) {
            std::memcpy(out, chunkView.data(), size);
        }
        *outputSize = size;
        return out;
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE uint8_t *projectorrays_get_script(uintptr_t handle,
                                                      int32_t id,
                                                      size_t *outputSize) {
    if (!handle || !outputSize) {
        return nullptr;
    }

    *outputSize = 0;

    try {
        auto *ptr = handleFromId(handle);
        if (!ptr || !ptr->dir) {
            return nullptr;
        }

        ptr->dir->config->unprotect();
        ptr->dir->parseScripts();

        for (const auto &cast : ptr->dir->casts) {
            if (!cast->lctx) {
                continue;
            }
            auto it = cast->lctx->scripts.find(id);
            if (it == cast->lctx->scripts.end()) {
                continue;
            }

            auto script = it->second;
            auto scriptChunk = static_cast<Director::ScriptChunk *>(script);
            Director::CastMemberChunk *member = scriptChunk->member;
            if (!member) {
                continue;
            }

            std::string scriptType;
            if (member->type == Director::kScriptMember) {
                auto scriptMember = static_cast<Director::ScriptMember *>(member->member.get());
                switch (scriptMember->scriptType) {
                case Director::kScoreScript:
                    scriptType = (ptr->dir->version >= 600) ? "BehaviorScript" : "ScoreScript";
                    break;
                case Director::kMovieScript:
                    scriptType = "MovieScript";
                    break;
                case Director::kParentScript:
                    scriptType = "ParentScript";
                    break;
                default:
                    scriptType = "UnknownScript";
                    break;
                }
            } else {
                scriptType = "CastScript";
            }

            Common::JSONWriter json("\n");
            json.startObject();
            json.writeField("scriptId", static_cast<int>(id));
            json.writeField("memberId", static_cast<int>(member->id));
            json.writeField("memberName", member->getName());
            json.writeField("scriptType", scriptType);
            json.writeField("castName", cast->name);
            json.writeKey("lingo");
            json.writeVal(script->scriptText("\n", ptr->dir->dotSyntax));
            json.writeKey("bytecode");
            json.writeVal(script->bytecodeText("\n", ptr->dir->dotSyntax));
            json.endObject();

            std::string outputStr = standardizeJsonEscapes(json.str());
            if (outputStr.empty()) {
                return nullptr;
            }

            uint8_t *out = static_cast<uint8_t *>(std::malloc(outputStr.size()));
            if (!out) {
                return nullptr;
            }
            std::memcpy(out, outputStr.data(), outputStr.size());
            *outputSize = outputStr.size();
            return out;
        }

        return nullptr;
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE uint8_t *projectorrays_implemented_dump_json(uintptr_t handle,
                                                                 size_t *outputSize) {
    if (!handle || !outputSize) {
        return nullptr;
    }

    *outputSize = 0;

    try {
        auto *ptr = handleFromId(handle);
        if (!ptr || !ptr->dir) {
            return nullptr;
        }

        std::string output = "[";
        bool first = true;

        for (const auto &entry : ptr->dir->chunkInfo) {
            const auto &info = entry.second;
            if (info.id == 0) {
                continue;
            }

            try {
                auto chunk = ptr->dir->getChunk(info.fourCC, info.id);
                if (!chunk) {
                    continue;
                }

                Common::JSONWriter json("\n");
                chunk->writeJSON(json);
                std::string chunkJson = standardizeJsonEscapes(json.str());
                if (chunkJson.empty()) {
                    continue;
                }

                if (!first) {
                    output += ",";
                }
                output += "{\"fourCC\":\"";
                output += Common::escapeString(Common::fourCCToString(info.fourCC));
                output += "\",\"id\":";
                output += std::to_string(info.id);
                output += ",\"data\":";
                output += chunkJson;
                output += "}";
                first = false;
            } catch (...) {
                continue;
            }
        }

        output += "]";
        output = standardizeJsonEscapes(output);
        if (output.empty()) {
            return nullptr;
        }

        uint8_t *out = static_cast<uint8_t *>(std::malloc(output.size()));
        if (!out) {
            return nullptr;
        }
        std::memcpy(out, output.data(), output.size());
        *outputSize = output.size();
        return out;
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE uint8_t *projectorrays_implemented_dump_chunks(uintptr_t handle, size_t *outputSize) {
    if (!handle || !outputSize) {
        return nullptr;
    }

    *outputSize = 0;

    try {
        auto *ptr = handleFromId(handle);
        if (!ptr || !ptr->dir) {
            return nullptr;
        }

        std::vector<uint8_t> output;
        auto appendUint32 = [&output](uint32_t value) {
            output.push_back(static_cast<uint8_t>(value & 0xff));
            output.push_back(static_cast<uint8_t>((value >> 8) & 0xff));
            output.push_back(static_cast<uint8_t>((value >> 16) & 0xff));
            output.push_back(static_cast<uint8_t>((value >> 24) & 0xff));
        };

        uint32_t count = 0;
        for (const auto &entry : ptr->dir->chunkInfo) {
            if (entry.first == 0) {
                continue;
            }
            ++count;
        }

        appendUint32(count);

        for (const auto &entry : ptr->dir->chunkInfo) {
            const auto &info = entry.second;
            const int32_t idValue = entry.first;
            if (idValue == 0) {
                continue;
            }
            Common::BufferView chunkView = ptr->dir->getChunkData(info.fourCC, idValue);

            appendUint32(info.fourCC);
            appendUint32(static_cast<uint32_t>(idValue));
            appendUint32(static_cast<uint32_t>(chunkView.size()));
            if (chunkView.size() > 0) {
                output.insert(output.end(), chunkView.data(), chunkView.data() + chunkView.size());
            }
        }

        if (output.empty()) {
            return nullptr;
        }

        uint8_t *out = static_cast<uint8_t *>(std::malloc(output.size()));
        if (!out) {
            return nullptr;
        }
        std::memcpy(out, output.data(), output.size());
        *outputSize = output.size();
        return out;
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE uint8_t *projectorrays_implemented_write_to_buffer(uintptr_t handle, size_t *outputSize) {
    if (!handle || !outputSize) {
        return nullptr;
    }

    *outputSize = 0;

    try {
        auto *ptr = handleFromId(handle);
        if (!ptr || !ptr->dir) {
            return nullptr;
        }

        ptr->dir->config->unprotect();
        ptr->dir->parseScripts();
        ptr->dir->restoreScriptText();

        std::vector<uint8_t> output;
        if (!writeDirectorToBuffer(*ptr->dir, output)) {
            return nullptr;
        }

        uint8_t *out = static_cast<uint8_t *>(std::malloc(output.size()));
        if (!out) {
            return nullptr;
        }
        std::memcpy(out, output.data(), output.size());
        *outputSize = output.size();
        return out;
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE uint8_t *projectorrays_implemented_dump_scripts(uintptr_t handle,
                                                                     size_t *outputSize) {
    if (!handle || !outputSize) {
        return nullptr;
    }

    *outputSize = 0;

    try {
        auto *ptr = handleFromId(handle);
        if (!ptr || !ptr->dir) {
            return nullptr;
        }

        ptr->dir->config->unprotect();
        ptr->dir->parseScripts();

        Common::JSONWriter json("\n");
        json.startObject();
        json.writeField("isCast", ptr->dir->isCast() ? 1 : 0);
        json.writeField("version", static_cast<int>(ptr->dir->version));
        json.writeKey("casts");
        json.startArray();
        for (const auto &cast : ptr->dir->casts) {
            if (!cast->lctx) {
                continue;
            }
            json.startObject();
            json.writeField("name", cast->name);
            json.writeKey("scripts");
            json.startArray();
            for (const auto &entry : cast->lctx->scripts) {
                auto script = entry.second;
                auto scriptChunk = static_cast<Director::ScriptChunk *>(script);
                Director::CastMemberChunk *member = scriptChunk->member;
                if (!member) {
                    continue;
                }

                std::string scriptType;
                if (member->type == Director::kScriptMember) {
                    auto scriptMember = static_cast<Director::ScriptMember *>(member->member.get());
                    switch (scriptMember->scriptType) {
                    case Director::kScoreScript:
                        scriptType = (ptr->dir->version >= 600) ? "BehaviorScript" : "ScoreScript";
                        break;
                    case Director::kMovieScript:
                        scriptType = "MovieScript";
                        break;
                    case Director::kParentScript:
                        scriptType = "ParentScript";
                        break;
                    default:
                        scriptType = "UnknownScript";
                        break;
                    }
                } else {
                    scriptType = "CastScript";
                }

                json.startObject();
                json.writeField("scriptId", static_cast<int>(entry.first));
                json.writeField("memberId", static_cast<int>(member->id));
                json.writeField("memberName", member->getName());
                json.writeField("scriptType", scriptType);
                json.writeKey("lingo");
                json.writeVal(script->scriptText("\n", ptr->dir->dotSyntax));
                json.writeKey("bytecode");
                json.writeVal(script->bytecodeText("\n", ptr->dir->dotSyntax));
                json.endObject();
            }
            json.endArray();
            json.endObject();
        }
        json.endArray();
        json.endObject();

        std::string outputStr = standardizeJsonEscapes(json.str());
        if (outputStr.empty()) {
            return nullptr;
        }

        uint8_t *out = static_cast<uint8_t *>(std::malloc(outputStr.size()));
        if (!out) {
            return nullptr;
        }
        std::memcpy(out, outputStr.data(), outputStr.size());
        *outputSize = outputStr.size();
        return out;
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE void projectorrays_free(uint8_t *buffer) { std::free(buffer); }

} // extern "C"
