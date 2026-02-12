"""Tests for payloads.py helper functions."""

import pytest
from payloads import (
    resolve_template,
    to_openai_payload,
    to_anthropic_payload,
)


class TestResolveTemplate:
    def test_replaces_variables(self):
        result = resolve_template("Hello {{name}}!", {"name": "World"})
        assert result == "Hello World!"

    def test_replaces_multiple_variables(self):
        result = resolve_template("{{greeting}} {{name}}!", {"greeting": "Hi", "name": "Alice"})
        assert result == "Hi Alice!"

    def test_leaves_unmatched_variables(self):
        result = resolve_template("Hello {{name}}!", {})
        assert result == "Hello {{name}}!"

    def test_handles_none(self):
        result = resolve_template(None, {"name": "World"})
        assert result == ""

    def test_handles_empty_string(self):
        result = resolve_template("", {"name": "World"})
        assert result == ""

    def test_partial_matches(self):
        result = resolve_template("{{a}} {{b}} {{c}}", {"a": "1", "c": "3"})
        assert result == "1 {{b}} 3"


class TestToOpenAIPayload:
    @pytest.fixture
    def base_config(self):
        return {
            "id": "test",
            "name": "Test",
            "model": "openai/gpt-4o",
            "systemPrompt": "",
            "userPromptTemplate": "",
            "temperature": 1.0,
            "maxTokens": 4096,
            "topP": 1.0,
            "topK": 0,
            "frequencyPenalty": 0,
            "presencePenalty": 0,
            "repetitionPenalty": 1.0,
            "minP": 0,
            "stopSequences": [],
            "responseFormat": "text",
            "jsonSchema": None,
            "tools": [],
            "toolChoice": "auto",
            "reasoning": False,
            "reasoningEffort": "medium",
            "sampleInputs": {},
        }

    def test_creates_basic_payload(self, base_config):
        base_config["systemPrompt"] = "You are helpful."
        base_config["userPromptTemplate"] = "Hello!"

        payload = to_openai_payload(base_config)

        assert payload["model"] == "openai/gpt-4o"
        assert payload["messages"] == [
            {"role": "system", "content": "You are helpful."},
            {"role": "user", "content": "Hello!"},
        ]

    def test_resolves_template_variables(self, base_config):
        base_config["userPromptTemplate"] = "Summarize: {{text}}"

        payload = to_openai_payload(base_config, {"text": "test content"})

        assert payload["messages"][0]["content"] == "Summarize: test content"

    def test_uses_sample_inputs_as_fallback(self, base_config):
        base_config["userPromptTemplate"] = "Summarize: {{text}}"
        base_config["sampleInputs"] = {"text": "sample text"}

        payload = to_openai_payload(base_config)

        assert payload["messages"][0]["content"] == "Summarize: sample text"

    def test_override_beats_sample_inputs(self, base_config):
        base_config["userPromptTemplate"] = "{{text}}"
        base_config["sampleInputs"] = {"text": "sample"}

        payload = to_openai_payload(base_config, {"text": "override"})

        assert payload["messages"][0]["content"] == "override"

    def test_includes_temperature(self, base_config):
        base_config["temperature"] = 0.7

        payload = to_openai_payload(base_config)

        assert payload["temperature"] == 0.7

    def test_includes_max_tokens(self, base_config):
        base_config["maxTokens"] = 2048

        payload = to_openai_payload(base_config)

        assert payload["max_tokens"] == 2048

    def test_excludes_top_p_when_1(self, base_config):
        base_config["topP"] = 1.0

        payload = to_openai_payload(base_config)

        assert "top_p" not in payload

    def test_includes_top_p_when_not_1(self, base_config):
        base_config["topP"] = 0.9

        payload = to_openai_payload(base_config)

        assert payload["top_p"] == 0.9

    def test_includes_stop_sequences(self, base_config):
        base_config["stopSequences"] = ["END", "STOP"]

        payload = to_openai_payload(base_config)

        assert payload["stop"] == ["END", "STOP"]

    def test_json_object_response_format(self, base_config):
        base_config["responseFormat"] = "json_object"

        payload = to_openai_payload(base_config)

        assert payload["response_format"] == {"type": "json_object"}

    def test_json_schema_response_format(self, base_config):
        schema = {"name": "test", "schema": {"type": "object"}}
        base_config["responseFormat"] = "json_schema"
        base_config["jsonSchema"] = schema

        payload = to_openai_payload(base_config)

        assert payload["response_format"] == {"type": "json_schema", "json_schema": schema}

    def test_includes_tools(self, base_config):
        tools = [{"type": "function", "function": {"name": "test", "description": "", "parameters": {}}}]
        base_config["tools"] = tools

        payload = to_openai_payload(base_config)

        assert payload["tools"] == tools

    def test_includes_tool_choice_when_not_auto(self, base_config):
        base_config["tools"] = [{"type": "function", "function": {"name": "test", "description": "", "parameters": {}}}]
        base_config["toolChoice"] = "required"

        payload = to_openai_payload(base_config)

        assert payload["tool_choice"] == "required"

    def test_excludes_tool_choice_when_auto(self, base_config):
        base_config["tools"] = [{"type": "function", "function": {"name": "test", "description": "", "parameters": {}}}]
        base_config["toolChoice"] = "auto"

        payload = to_openai_payload(base_config)

        assert "tool_choice" not in payload

    def test_includes_reasoning_when_enabled(self, base_config):
        base_config["reasoning"] = True
        base_config["reasoningEffort"] = "high"

        payload = to_openai_payload(base_config)

        assert payload["reasoning"] == {"effort": "high"}

    def test_excludes_reasoning_when_disabled(self, base_config):
        base_config["reasoning"] = False

        payload = to_openai_payload(base_config)

        assert "reasoning" not in payload


class TestToAnthropicPayload:
    @pytest.fixture
    def base_config(self):
        return {
            "id": "test",
            "name": "Test",
            "model": "anthropic/claude-sonnet-4-5",
            "systemPrompt": "",
            "userPromptTemplate": "",
            "temperature": 1.0,
            "maxTokens": 4096,
            "topP": 1.0,
            "topK": 0,
            "stopSequences": [],
            "tools": [],
            "toolChoice": "auto",
            "sampleInputs": {},
        }

    def test_strips_provider_prefix(self, base_config):
        payload = to_anthropic_payload(base_config)
        assert payload["model"] == "claude-sonnet-4-5"

    def test_handles_model_without_prefix(self, base_config):
        base_config["model"] = "claude-sonnet-4-5"
        payload = to_anthropic_payload(base_config)
        assert payload["model"] == "claude-sonnet-4-5"

    def test_system_prompt_at_top_level(self, base_config):
        base_config["systemPrompt"] = "You are helpful."
        base_config["userPromptTemplate"] = "Hello!"

        payload = to_anthropic_payload(base_config)

        assert payload["system"] == "You are helpful."
        assert payload["messages"] == [{"role": "user", "content": "Hello!"}]

    def test_always_includes_max_tokens(self, base_config):
        base_config["maxTokens"] = 0

        payload = to_anthropic_payload(base_config)

        assert payload["max_tokens"] == 4096  # Default fallback

    def test_uses_stop_sequences_naming(self, base_config):
        base_config["stopSequences"] = ["END"]

        payload = to_anthropic_payload(base_config)

        assert payload["stop_sequences"] == ["END"]

    def test_converts_tools_to_anthropic_format(self, base_config):
        base_config["tools"] = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get weather",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]

        payload = to_anthropic_payload(base_config)

        assert payload["tools"] == [
            {
                "name": "get_weather",
                "description": "Get weather",
                "input_schema": {"type": "object", "properties": {}},
            }
        ]

    def test_converts_tool_choice_required_to_any(self, base_config):
        base_config["tools"] = [{"type": "function", "function": {"name": "test", "description": "", "parameters": {}}}]
        base_config["toolChoice"] = "required"

        payload = to_anthropic_payload(base_config)

        assert payload["tool_choice"] == {"type": "any"}

    def test_converts_tool_choice_none(self, base_config):
        base_config["tools"] = [{"type": "function", "function": {"name": "test", "description": "", "parameters": {}}}]
        base_config["toolChoice"] = "none"

        payload = to_anthropic_payload(base_config)

        assert payload["tool_choice"] == {"type": "none"}

    def test_omits_tool_choice_when_auto(self, base_config):
        base_config["tools"] = [{"type": "function", "function": {"name": "test", "description": "", "parameters": {}}}]
        base_config["toolChoice"] = "auto"

        payload = to_anthropic_payload(base_config)

        assert "tool_choice" not in payload
